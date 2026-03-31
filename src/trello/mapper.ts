import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TrelloApi } from './api';
import { TrelloBoard, TrelloList, WorkspaceConfig } from './types';

const CONFIG_FILE = '.trello-pilot.json';

export class WorkspaceMapper {
  constructor(private api: TrelloApi) {}

  getConfigPath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;
    return path.join(folders[0].uri.fsPath, CONFIG_FILE);
  }

  loadConfig(): WorkspaceConfig | undefined {
    const configPath = this.getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) return undefined;

    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as WorkspaceConfig;
  }

  async saveConfig(config: WorkspaceConfig): Promise<void> {
    const configPath = this.getConfigPath();
    if (!configPath) throw new Error('No workspace folder open');

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  async setupWizard(): Promise<WorkspaceConfig | undefined> {
    const boards = await this.api.getBoards();

    const boardPick = await vscode.window.showQuickPick(
      boards.map((b) => ({ label: b.name, detail: b.url, board: b })),
      { placeHolder: 'Select the Trello board for this project', title: 'Trello Code Pilot Setup' },
    );
    if (!boardPick) return undefined;

    const board: TrelloBoard = boardPick.board;
    const lists = await this.api.getBoardLists(board.id);

    const todoList = await this.pickList(lists, 'Select the "To Do" list');
    if (!todoList) return undefined;

    const doingList = await this.pickList(lists, 'Select the "In Progress" list');
    if (!doingList) return undefined;

    const doneList = await this.pickList(lists, 'Select the "Done" list');
    if (!doneList) return undefined;

    const reviewList = await this.pickList(lists, 'Select a "Review" list (optional, press Esc to skip)');

    const config: WorkspaceConfig = {
      boardId: board.id,
      boardUrl: board.url,
      boardName: board.name,
      lists: {
        todo: todoList.id,
        doing: doingList.id,
        done: doneList.id,
        ...(reviewList ? { review: reviewList.id } : {}),
      },
    };

    await this.saveConfig(config);

    vscode.window.showInformationMessage(
      `Trello Code Pilot connected to board "${board.name}"`,
    );

    return config;
  }

  private async pickList(
    lists: TrelloList[],
    placeholder: string,
  ): Promise<TrelloList | undefined> {
    const pick = await vscode.window.showQuickPick(
      lists.map((l) => ({ label: l.name, list: l })),
      { placeHolder: placeholder },
    );
    return pick?.list;
  }
}
