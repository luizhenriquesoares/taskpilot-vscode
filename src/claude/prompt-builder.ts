import { TrelloCard } from '../trello/types';

export class PromptBuilder {
  build(card: TrelloCard): string {
    const sections: string[] = [];

    sections.push(`# Task: ${card.name}`);
    sections.push('');

    if (card.desc) {
      sections.push('## Description');
      sections.push(card.desc);
      sections.push('');
    }

    if (card.labels?.length) {
      const labelStr = card.labels.map((l) => l.name || l.color).join(', ');
      sections.push(`**Labels:** ${labelStr}`);
      sections.push('');
    }

    if (card.due) {
      const dueDate = new Date(card.due).toLocaleDateString();
      sections.push(`**Due:** ${dueDate}`);
      sections.push('');
    }

    if (card.checklists?.length) {
      sections.push('## Checklist');
      for (const checklist of card.checklists) {
        sections.push(`### ${checklist.name}`);
        for (const item of checklist.checkItems) {
          const mark = item.state === 'complete' ? 'x' : ' ';
          sections.push(`- [${mark}] ${item.name}`);
        }
        sections.push('');
      }
    }

    if (card.attachments?.length) {
      sections.push('## References');
      for (const att of card.attachments) {
        sections.push(`- [${att.name}](${att.url})`);
      }
      sections.push('');
    }

    sections.push('## Instructions');
    sections.push(
      'Implement this task following the project conventions. ' +
      'Read the codebase to understand patterns before making changes. ' +
      'Create tests if the project has a test suite. ' +
      'Commit when done with a clear message referencing this task.',
    );
    sections.push('');
    sections.push(`Trello card: ${card.url}`);

    return sections.join('\n');
  }

  buildBranchName(card: TrelloCard, prefix: string): string {
    const slug = card.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
      .replace(/-$/, '');

    return `${prefix}${slug}`;
  }
}
