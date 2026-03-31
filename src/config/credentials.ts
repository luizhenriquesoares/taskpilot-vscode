import * as vscode from 'vscode';
import { TrelloCredentials } from '../trello/types';

const SECRET_KEY = 'trelloPilot.apiKey';
const SECRET_TOKEN = 'trelloPilot.apiToken';

export class CredentialStore {
  constructor(private secrets: vscode.SecretStorage) {}

  async getCredentials(): Promise<TrelloCredentials | undefined> {
    const key = await this.secrets.get(SECRET_KEY);
    const token = await this.secrets.get(SECRET_TOKEN);

    if (!key || !token) return undefined;
    return { key, token };
  }

  async setCredentials(): Promise<TrelloCredentials | undefined> {
    const key = await vscode.window.showInputBox({
      prompt: 'Enter your Trello API Key',
      placeHolder: 'Get it from https://trello.com/power-ups/admin',
      ignoreFocusOut: true,
    });
    if (!key) return undefined;

    const token = await vscode.window.showInputBox({
      prompt: 'Enter your Trello API Token',
      placeHolder: 'Generate from the API key page',
      password: true,
      ignoreFocusOut: true,
    });
    if (!token) return undefined;

    await this.secrets.store(SECRET_KEY, key);
    await this.secrets.store(SECRET_TOKEN, token);

    vscode.window.showInformationMessage('Trello credentials saved securely');
    return { key, token };
  }

  async clearCredentials(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
    await this.secrets.delete(SECRET_TOKEN);
  }
}
