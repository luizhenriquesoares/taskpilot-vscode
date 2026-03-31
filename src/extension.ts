import * as vscode from 'vscode';
import { TrelloApi } from './trello/api';
import { WorkspaceMapper } from './trello/mapper';
import { CredentialStore } from './config/credentials';
import { CardsTreeProvider, CardTreeItem } from './views/sidebar';
import { AgentRunner } from './claude/agent-runner';

let treeProvider: CardsTreeProvider;

export async function activate(context: vscode.ExtensionContext) {
  const credentialStore = new CredentialStore(context.secrets);

  // Try to load credentials
  let credentials = await credentialStore.getCredentials();

  const ensureCredentials = async () => {
    if (!credentials) {
      credentials = await credentialStore.setCredentials();
    }
    if (!credentials) {
      throw new Error('Trello credentials are required. Run "Trello Code Pilot: Set Credentials"');
    }
    return credentials;
  };

  // Register set credentials command
  context.subscriptions.push(
    vscode.commands.registerCommand('trelloPilot.setCredentials', async () => {
      credentials = await credentialStore.setCredentials();
      if (credentials) {
        vscode.window.showInformationMessage('Credentials saved. Run Sync to load cards.');
      }
    }),
  );

  // Register setup command
  context.subscriptions.push(
    vscode.commands.registerCommand('trelloPilot.setup', async () => {
      try {
        const creds = await ensureCredentials();
        const api = new TrelloApi(creds);
        const mapper = new WorkspaceMapper(api);
        const config = await mapper.setupWizard();

        if (config && treeProvider) {
          treeProvider.updateConfig(config);
          await treeProvider.refresh();
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Setup failed: ${err.message}`);
      }
    }),
  );

  // Register sync command
  context.subscriptions.push(
    vscode.commands.registerCommand('trelloPilot.sync', async () => {
      try {
        const creds = await ensureCredentials();
        const api = new TrelloApi(creds);
        const mapper = new WorkspaceMapper(api);

        let config = mapper.loadConfig();
        if (!config) {
          config = await mapper.setupWizard();
          if (!config) return;
        }

        treeProvider.updateConfig(config);
        await treeProvider.refresh();

        vscode.window.showInformationMessage('Trello cards synced');
      } catch (err: any) {
        vscode.window.showErrorMessage(`Sync failed: ${err.message}`);
      }
    }),
  );

  // Register run card command
  context.subscriptions.push(
    vscode.commands.registerCommand('trelloPilot.runCard', async (item?: CardTreeItem) => {
      try {
        const creds = await ensureCredentials();
        const api = new TrelloApi(creds);
        const mapper = new WorkspaceMapper(api);
        const config = mapper.loadConfig();

        if (!config) {
          vscode.window.showWarningMessage('Run Setup first to connect a Trello board.');
          return;
        }

        let card = item?.card;

        // If no card passed (command palette), let user pick
        if (!card) {
          const cardItems = treeProvider.getCardItems();
          if (!cardItems.length) {
            vscode.window.showInformationMessage('No cards in the To Do list. Sync first.');
            return;
          }

          const pick = await vscode.window.showQuickPick(
            cardItems.map((ci) => ({ label: ci.card.name, card: ci.card })),
            { placeHolder: 'Select a card to run the agent on' },
          );
          if (!pick) return;
          card = pick.card;
        }

        const confirm = await vscode.window.showInformationMessage(
          `Run Claude Code agent on "${card.name}"?`,
          'Run',
          'Cancel',
        );
        if (confirm !== 'Run') return;

        const runner = new AgentRunner(api, config);

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Running agent: ${card.name}`,
            cancellable: false,
          },
          async () => {
            const result = await runner.run(card!);
            if (result.success) {
              vscode.window.showInformationMessage(
                `Agent completed: "${card!.name}"`,
              );
              await treeProvider.refresh();
            }
          },
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Agent failed: ${err.message}`);
      }
    }),
  );

  // Register run all command
  context.subscriptions.push(
    vscode.commands.registerCommand('trelloPilot.runAll', async () => {
      try {
        const creds = await ensureCredentials();
        const api = new TrelloApi(creds);
        const mapper = new WorkspaceMapper(api);
        const config = mapper.loadConfig();

        if (!config) {
          vscode.window.showWarningMessage('Run Setup first to connect a Trello board.');
          return;
        }

        const cardItems = treeProvider.getCardItems();
        if (!cardItems.length) {
          vscode.window.showInformationMessage('No cards in the To Do list.');
          return;
        }

        const confirm = await vscode.window.showInformationMessage(
          `Run Claude Code agent on ${cardItems.length} cards?`,
          'Run All',
          'Cancel',
        );
        if (confirm !== 'Run All') return;

        const runner = new AgentRunner(api, config);

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Running agents on all cards...',
            cancellable: false,
          },
          async (progress) => {
            for (let i = 0; i < cardItems.length; i++) {
              const card = cardItems[i].card;
              progress.report({
                message: `(${i + 1}/${cardItems.length}) ${card.name}`,
                increment: (100 / cardItems.length),
              });
              await runner.run(card);
            }
            vscode.window.showInformationMessage(
              `All ${cardItems.length} cards processed!`,
            );
            await treeProvider.refresh();
          },
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Run all failed: ${err.message}`);
      }
    }),
  );

  // Initialize tree view
  if (credentials) {
    const api = new TrelloApi(credentials);
    const mapper = new WorkspaceMapper(api);
    const config = mapper.loadConfig();

    treeProvider = new CardsTreeProvider(api, config);
  } else {
    treeProvider = new CardsTreeProvider(
      new TrelloApi({ key: '', token: '' }),
      undefined,
    );
  }

  const treeView = vscode.window.createTreeView('trelloPilot.cards', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Auto-sync on activation if config exists
  if (credentials) {
    const api = new TrelloApi(credentials);
    const mapper = new WorkspaceMapper(api);
    if (mapper.loadConfig()) {
      treeProvider.refresh();
    }
  }
}

export function deactivate() {}
