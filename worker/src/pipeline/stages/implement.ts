import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { WorkerEvent } from '../../shared';
import type { HeadlessRunner } from '../../claude/headless-runner';
import type { RepoManager } from '../../git/repo-manager';
import type { ComplexityEstimator } from '../../analysis/complexity-estimator';
import type { TrelloCommenter } from '../../notifications/trello-commenter';
import type { SlackNotifier } from '../../notifications/slack';

interface TrelloAttachment {
  name: string;
  url: string;
  mimeType?: string;
}

interface TrelloCheckItem {
  name: string;
  state: 'complete' | 'incomplete';
}

interface TrelloChecklist {
  name: string;
  checkItems: TrelloCheckItem[];
}

interface TrelloCardDetails {
  idShort?: number;
  name: string;
  desc: string;
  url: string;
  attachments?: TrelloAttachment[];
  checklists?: TrelloChecklist[];
}

interface TrelloApiClient {
  getCard(cardId: string): Promise<TrelloCardDetails>;
}

interface ImplementDeps {
  runner: HeadlessRunner;
  repoManager: RepoManager;
  complexityEstimator: ComplexityEstimator;
  trelloApi: TrelloApiClient;
  trelloCommenter: TrelloCommenter;
  slackNotifier: SlackNotifier;
}

interface ImplementResult {
  branchName: string;
  prUrl: string;
  costUsd: number;
  durationMs: number;
  workDir: string;
}

function buildBranchName(cardName: string, prefix: string, idShort?: number): string {
  const slug = cardName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 25)
    .replace(/-$/, '');
  const num = idShort ? `${idShort}-` : '';
  return `${prefix}${num}${slug}`;
}

export class ImplementStage {
  async run(event: WorkerEvent, deps: ImplementDeps): Promise<ImplementResult> {
    const { runner, repoManager, complexityEstimator, trelloCommenter, slackNotifier } = deps;
    const { cardId, repoConfig } = event;

    // Fetch card details from Trello
    const card = await deps.trelloApi.getCard(cardId);

    // Prepare working directory
    const workDir = path.join(
      os.tmpdir(),
      'trello-pilot',
      `${cardId}-${Date.now()}`,
    );
    fs.mkdirSync(workDir, { recursive: true });

    // Clone the repository
    await repoManager.clone(
      repoConfig.repoUrl,
      workDir,
      repoConfig.baseBranch,
    );

    // Create feature branch (include card number so review/QA can find it)
    const branchPrefix = repoConfig.branchPrefix ?? 'feat/';
    const branchName = buildBranchName(card.name, branchPrefix, card.idShort);
    await repoManager.createBranch(workDir, branchName);

    // Estimate complexity
    const complexity = await complexityEstimator.estimate(workDir, card.desc || card.name);
    const complexityLabel = `${complexity.size} (${complexity.confidence} confidence, ~${complexity.estimatedMinutes}min)`;

    // Comment on Trello: implementation started
    await trelloCommenter.implementStarted(cardId, branchName, complexityLabel);

    // Notify Slack
    await slackNotifier.implementStarted(card.name, branchName, complexityLabel);

    // Build the full implementation prompt
    const prompt = buildImplementPrompt(card, repoConfig.rules);

    if (!promptHasActionableContext(card)) {
      // Card has no description, checklist, or reference — Claude would have
      // nothing to implement and the run would produce no commits. Surface a
      // clear, actionable message instead of burning a Claude run + failing PR.
      throw new Error(
        'Card sem contexto acionável: adicione uma descrição (o quê / onde no código / '
        + 'comportamento esperado) ou um checklist. Links de anexo (ex: SEMrush) exigem '
        + 'login e não são lidos automaticamente — cole o conteúdo do issue na descrição.',
      );
    }

    // Run Claude headless
    const result = await runner.run(workDir, prompt);

    // Push changes
    await repoManager.push(workDir, branchName);

    // Create PR
    const commitLog = await repoManager.getCommitLog(workDir);
    const prBody = [
      `## Trello Card`,
      `${card.url}`,
      '',
      '## Changes',
      commitLog || 'Implementation of task.',
      '',
      '---',
      '_Automated by Trello Code Pilot Worker_',
    ].join('\n');

    const prUrl = await repoManager.createPr(
      workDir,
      card.name,
      prBody,
      repoConfig.baseBranch,
    );

    // Comment on Trello: implementation done
    await trelloCommenter.implementDone(
      cardId,
      branchName,
      prUrl,
      result.costUsd,
      result.durationMs,
    );

    // Notify Slack
    await slackNotifier.implementDone(
      card.name,
      branchName,
      prUrl,
      result.costUsd,
      result.durationMs,
    );

    return {
      branchName,
      prUrl,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      workDir,
    };
  }
}

function isImageAttachment(att: TrelloAttachment): boolean {
  return (
    att.mimeType?.startsWith('image/') === true
    || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(att.name)
  );
}

/**
 * A card is actionable if it carries something Claude can implement from:
 * a description, at least one checklist item, or a reference link. Cards with
 * only a title (or only image/link attachments and no text) have no context.
 */
function promptHasActionableContext(card: TrelloCardDetails): boolean {
  if (card.desc && card.desc.trim().length > 0) return true;
  const hasCheckItems = card.checklists?.some((cl) => cl.checkItems.length > 0);
  if (hasCheckItems) return true;
  const hasReference = card.attachments?.some((att) => !isImageAttachment(att));
  return hasReference === true;
}

function buildImplementPrompt(card: TrelloCardDetails, rules?: string[]): string {
  const sections: string[] = [];

  sections.push(`# Task: ${card.name}`);
  sections.push('');

  if (card.desc) {
    sections.push('## Description');
    sections.push(card.desc);
    sections.push('');
  }

  // Checklists → acceptance criteria
  const checklistsWithItems = card.checklists?.filter((cl) => cl.checkItems.length > 0) ?? [];
  if (checklistsWithItems.length > 0) {
    sections.push('## Acceptance Criteria');
    for (const checklist of checklistsWithItems) {
      sections.push(`### ${checklist.name}`);
      for (const item of checklist.checkItems) {
        const mark = item.state === 'complete' ? 'x' : ' ';
        sections.push(`- [${mark}] ${item.name}`);
      }
    }
    sections.push('');
  }

  // Non-image attachments → reference links
  const references = card.attachments?.filter((att) => !isImageAttachment(att)) ?? [];
  if (references.length > 0) {
    sections.push('## References');
    for (const att of references) {
      sections.push(`- [${att.name}](${att.url})`);
    }
    sections.push(
      '_Note: some reference links (e.g. SEMrush) require login and cannot be opened. '
      + 'Rely on the description and acceptance criteria above for the actual requirements._',
    );
    sections.push('');
  }

  if (rules && rules.length > 0) {
    sections.push('## Project Rules');
    sections.push('You MUST follow these rules strictly:');
    for (const rule of rules) {
      sections.push(`- ${rule}`);
    }
    sections.push('');
  }

  sections.push('## Instructions');
  sections.push(
    'Implement this task following the project rules and conventions above. '
    + 'Read the codebase to understand existing patterns before making changes. '
    + 'Commit when done with a clear message referencing this task.',
  );
  sections.push('');
  sections.push(`Trello card: ${card.url}`);

  return sections.join('\n');
}
