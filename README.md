# Trello Code Pilot

VS Code extension that syncs your Trello board with your codebase and lets **Claude Code agents** implement tasks automatically.

Press **Sync** → see your cards → press **Run** → the AI agent reads the card, creates a branch, implements the task, and moves the card forward.

## Features

- **Board ↔ Repo mapping** — connect any Trello board to your project via setup wizard
- **Sidebar with cards** — see To Do, In Progress, and Review cards directly in VS Code
- **One-click agent execution** — run Claude Code on a single card or all cards at once
- **Auto branch creation** — creates a feature branch per card
- **Auto card movement** — moves cards to "In Progress" when agent starts, "Review" when done
- **Secure credentials** — Trello API keys stored in VS Code's secret storage (not in files)

## Getting Started

### 1. Install the extension

```bash
# From source (development)
git clone https://github.com/luizhenriquesoares/trello-code-pilot.git
cd trello-code-pilot
npm install
npm run build
# Press F5 in VS Code to launch Extension Development Host
```

### 2. Get Trello API credentials

1. Go to https://trello.com/power-ups/admin
2. Create a new Power-Up (or use existing)
3. Copy your **API Key**
4. Generate a **Token** from the API key page

### 3. Configure

1. Open VS Code Command Palette (`Cmd+Shift+P`)
2. Run `Trello Code Pilot: Set Trello API Credentials`
3. Enter your API Key and Token
4. Run `Trello Code Pilot: Setup Board Connection`
5. Select your board and map your lists (To Do, In Progress, Done)

This creates a `.trello-pilot.json` in your project root:

```json
{
  "boardId": "abc123",
  "boardUrl": "https://trello.com/b/abc123/my-project",
  "boardName": "My Project",
  "lists": {
    "todo": "list-id-1",
    "doing": "list-id-2",
    "done": "list-id-3",
    "review": "list-id-4"
  }
}
```

### 4. Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Node.js 18+

## Usage

### Sync cards
Click the **sync icon** in the Trello Code Pilot sidebar header, or run `Trello Code Pilot: Sync Cards` from the command palette.

### Run agent on a single card
Right-click a card in the sidebar → **Run Agent**, or click the **play icon** next to the card.

### Run agent on all To Do cards
Click the **run-all icon** in the sidebar header. The agent will process each card sequentially.

### What the agent does

For each card:

1. Moves the card to "In Progress" on Trello
2. Creates a git branch (e.g., `feat/implement-user-auth`)
3. Reads the card title, description, checklists, and attachments
4. Runs Claude Code with the full task context
5. Claude Code implements the task, following your project conventions
6. Moves the card to "Review" (or "Done")

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `trelloPilot.claudeCodePath` | `claude` | Path to Claude Code CLI |
| `trelloPilot.autoMoveCard` | `true` | Auto-move cards between lists |
| `trelloPilot.createBranch` | `true` | Create git branch per card |
| `trelloPilot.branchPrefix` | `feat/` | Prefix for auto-created branches |

## Development

```bash
npm install
npm run watch    # Watch mode
# Press F5 to launch Extension Development Host
```

## License

MIT
