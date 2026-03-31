import * as vscode from 'vscode';
import { TrelloCard, TrelloList, WorkspaceConfig } from '../trello/types';
import { TrelloApi } from '../trello/api';

export class CardTreeItem extends vscode.TreeItem {
  constructor(
    public readonly card: TrelloCard,
    public readonly listName: string,
  ) {
    super(card.name, vscode.TreeItemCollapsibleState.None);

    this.tooltip = `${card.name}\n${card.desc?.substring(0, 200) || 'No description'}`;
    this.description = listName;
    this.contextValue = 'card';

    // Icon based on labels
    if (card.labels?.length) {
      const color = card.labels[0].color;
      this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(
        this.labelColorToTheme(color),
      ));
    } else {
      this.iconPath = new vscode.ThemeIcon('note');
    }

    if (card.due) {
      const due = new Date(card.due);
      const now = new Date();
      if (due < now && !card.dueComplete) {
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('errorForeground'));
      }
    }
  }

  private labelColorToTheme(color: string): string {
    const map: Record<string, string> = {
      red: 'errorForeground',
      orange: 'editorWarning.foreground',
      yellow: 'editorWarning.foreground',
      green: 'testing.iconPassed',
      blue: 'textLink.foreground',
      purple: 'textLink.activeForeground',
    };
    return map[color] || 'foreground';
  }
}

export class ListTreeItem extends vscode.TreeItem {
  constructor(
    public readonly list: TrelloList,
    public readonly cards: TrelloCard[],
  ) {
    super(list.name, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${cards.length} cards`;
    this.iconPath = new vscode.ThemeIcon('list-unordered');
    this.contextValue = 'list';
  }
}

export class CardsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lists: TrelloList[] = [];
  private cards: TrelloCard[] = [];

  constructor(
    private api: TrelloApi,
    private config: WorkspaceConfig | undefined,
  ) {}

  updateConfig(config: WorkspaceConfig) {
    this.config = config;
  }

  async refresh(): Promise<void> {
    if (!this.config) return;

    this.lists = await this.api.getBoardLists(this.config.boardId);
    this.cards = await this.api.getBoardCards(this.config.boardId);

    // Filter only the mapped lists (todo, doing, review)
    const relevantListIds = new Set([
      this.config.lists.todo,
      this.config.lists.doing,
      ...(this.config.lists.review ? [this.config.lists.review] : []),
    ]);

    this.lists = this.lists.filter((l) => relevantListIds.has(l.id));
    this.cards = this.cards.filter((c) => relevantListIds.has(c.idList));

    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return this.lists.map((list) => {
        const listCards = this.cards.filter((c) => c.idList === list.id);
        return new ListTreeItem(list, listCards);
      });
    }

    if (element instanceof ListTreeItem) {
      return element.cards.map((card) => new CardTreeItem(card, element.list.name));
    }

    return [];
  }

  getCardItems(): CardTreeItem[] {
    if (!this.config) return [];

    const todoCards = this.cards.filter((c) => c.idList === this.config!.lists.todo);
    const todoList = this.lists.find((l) => l.id === this.config!.lists.todo);

    return todoCards.map((card) => new CardTreeItem(card, todoList?.name || 'To Do'));
  }
}
