import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { TrelloCard, WorkspaceConfig } from '../trello/types';
import { TrelloApi } from '../trello/api';
import { PromptBuilder } from './prompt-builder';

export interface AgentRunResult {
  success: boolean;
  output: string;
  card: TrelloCard;
}

export class AgentRunner {
  private promptBuilder = new PromptBuilder();

  constructor(
    private api: TrelloApi,
    private config: WorkspaceConfig,
  ) {}

  async run(card: TrelloCard): Promise<AgentRunResult> {
    const settings = vscode.workspace.getConfiguration('trelloPilot');
    const claudePath = settings.get<string>('claudeCodePath', 'claude');
    const autoMove = settings.get<boolean>('autoMoveCard', true);
    const createBranch = settings.get<boolean>('createBranch', true);
    const branchPrefix = settings.get<string>('branchPrefix', 'feat/');

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace folder open');
    }

    // Move card to "doing"
    if (autoMove && this.config.lists.doing) {
      await this.api.moveCard(card.id, this.config.lists.doing);
    }

    // Create branch
    if (createBranch) {
      const branchName = this.promptBuilder.buildBranchName(card, branchPrefix);
      await this.execGit(workspaceRoot, ['checkout', '-b', branchName]);
    }

    // Build prompt and run Claude Code
    const prompt = this.promptBuilder.build(card);
    const output = await this.runClaudeCode(claudePath, workspaceRoot, prompt);

    // Move card to "review" or "done"
    if (autoMove) {
      const targetList = this.config.lists.review || this.config.lists.done;
      if (targetList) {
        await this.api.moveCard(card.id, targetList);
      }
    }

    return { success: true, output, card };
  }

  private runClaudeCode(claudePath: string, cwd: string, prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '--print', prompt,
        '--dangerously-skip-permissions',
      ];

      const proc = spawn(claudePath, args, {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude Code exited with code ${code}\n${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to start Claude Code: ${err.message}`));
      });
    });
  }

  private execGit(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`git ${args.join(' ')} failed: ${stderr}`));
      });
    });
  }
}
