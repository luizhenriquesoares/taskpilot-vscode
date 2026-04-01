# Trello Code Pilot

> Turn Trello cards into code with a full AI-powered CI pipeline — implement, review, test, and merge — all from VS Code.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/LuizHenriqueSoares.trello-code-pilot)](https://marketplace.visualstudio.com/items?itemName=LuizHenriqueSoares.trello-code-pilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What it does

Trello Code Pilot connects your Trello board to your codebase and runs a full AI pipeline on each card:

1. **Implement** — Claude Code reads the card, creates a branch, and writes the code
2. **Review** — An AI reviewer analyzes the diff for bugs, security issues, and rule violations
3. **QA** — Runs tests, validates compilation, and if everything passes, merges to main and pushes

You click a button. The AI does the rest.

---

## Pipeline

```
  Todo          Doing         Review          QA            Done
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  ✏ Card  │──▶│  ▶ Code │──▶│  🔍 Scan │──▶│  🧪 Test │──▶│  ✓ Ship │
│         │   │         │   │  Bugs   │   │  Build  │   │  Merge  │
│         │   │  Branch │   │  SOLID  │   │  Lint   │   │  Push   │
│         │   │  Commit │   │  Rules  │   │  Merge  │   │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

Each stage opens Claude Code in an interactive IDE terminal, so you can watch and intervene at any point.

---

## Features

- **Full CI pipeline** — Todo → Doing → Review → QA → Done, each with its own AI agent
- **Project rules** — Define coding standards in `.trello-pilot.json` and they're enforced automatically
- **Pipeline dashboard** — Visual card counters per stage in the sidebar
- **Card detail view** — Click any card to see full description, checklists, labels, and attachments
- **Smart icons** — Each pipeline stage has its own icon (inbox, play, search, beaker, check)
- **Auto branch** — Creates `feat/card-name` branches automatically
- **Auto card movement** — Moves cards through your workflow on Trello
- **Auto-sync** — Refreshes from Trello every 5 minutes
- **Claude Code integration** — Opens in the IDE terminal via `claude-vscode.terminal.open`
- **Rich card info** — Labels, due dates, checklists progress, overdue warnings
- **Credential fallback** — Stores API keys in SecretStorage + config file as backup

---

## Quick Start

### 1. Install

Search for **"Trello Code Pilot"** in the VS Code Extensions tab (`Cmd+Shift+X` / `Ctrl+Shift+X`).

Or via CLI:

```bash
code --install-extension LuizHenriqueSoares.trello-code-pilot
```

### 2. Get Trello API Credentials

1. Go to [trello.com/power-ups/admin](https://trello.com/power-ups/admin)
2. Create a new Power-Up (or use an existing one)
3. Copy your **API Key**
4. Generate a **Token** from the API key page

### 3. Configure

1. `Cmd+Shift+P` → **Trello Code Pilot: Set Trello API Credentials**
2. Enter your API Key and Token
3. `Cmd+Shift+P` → **Trello Code Pilot: Setup Board Connection**
4. Select your board and map your lists (Todo, Doing, Done, Review, QA)

This creates a `.trello-pilot.json` in your project:

```json
{
  "boardId": "abc123",
  "boardUrl": "https://trello.com/b/abc123/my-project",
  "boardName": "My Project",
  "lists": {
    "todo": "list-id-1",
    "doing": "list-id-2",
    "done": "list-id-3",
    "review": "list-id-4",
    "qa": "list-id-5"
  },
  "rules": [
    "Follow Clean Architecture: domain → application → infrastructure → presentation",
    "Never use 'any' in TypeScript — use proper interfaces/types",
    "Apply SOLID principles",
    "Commit with clear, concise message in English"
  ]
}
```

### 4. Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [Claude Code VS Code extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) installed
- Node.js 18+
- A Trello account with API access

---

## Usage

### Pipeline actions

| List | Button | What happens |
|------|--------|-------------|
| **Todo** | ▶ Play | Creates branch, opens Claude Code to implement the task |
| **Doing** | ▶ Play | Continues implementation |
| **Review** | 🔍 Search | Opens Claude Code to review: bugs, security, SOLID, rules compliance |
| **QA** | 🧪 Beaker | Runs tests, validates build, merges to main & pushes if all pass |

### Card detail

Click any card in the sidebar to open a detail view with description, checklists, labels, and attachments.

### Sync cards

Click the **sync icon** (↻) in the sidebar header. Cards auto-sync every 5 minutes.

### Run all cards

Click the **run-all icon** in the sidebar header. Choose sequential or parallel execution.

---

## Project Rules

Define rules in `.trello-pilot.json` under the `rules` array. These are injected into every agent prompt:

```json
{
  "rules": [
    "## Backend (NestJS)",
    "Use cases must have a single execute() method",
    "Repositories: interface in application/ports/, implementation in infrastructure/",
    "Throw domain-specific errors extending DomainError",

    "## Frontend (React)",
    "Use b2bFetch() from lib/b2b-api.ts — never use fetch() directly",
    "Style with Tailwind CSS + Radix UI components",
    "Use useToast() for error feedback",

    "## General",
    "Never use 'any' in TypeScript",
    "Apply SOLID principles",
    "Use constants for fixed values — no magic numbers"
  ]
}
```

Rules are enforced during implementation and validated during review.

---

## How Each Agent Works

### Implement Agent (▶ Play)

1. Moves card to "Doing" on Trello
2. Creates a `feat/card-name` branch
3. Builds a prompt from card title, description, checklists, attachments, and project rules
4. Opens Claude Code in the IDE terminal

### Review Agent (🔍 Search)

1. Switches to the card's branch
2. Runs `git diff main...HEAD` to see all changes
3. Analyzes for: bugs, security issues, SOLID violations, project rules compliance, dead code
4. Fixes issues directly and commits, or reports "Review passed"

### QA Agent (🧪 Beaker)

1. Switches to the card's branch
2. Runs `npx tsc --noEmit` to validate compilation
3. Runs test suite if it exists
4. Checks for console.log, unused imports, lint errors
5. If all checks pass: merges to main and pushes
6. If checks fail: fixes and retries, or reports failures

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `trelloPilot.claudeCodePath` | `claude` | Path to Claude Code CLI |
| `trelloPilot.autoMoveCard` | `true` | Auto-move cards between lists |
| `trelloPilot.createBranch` | `true` | Create git branch per card |
| `trelloPilot.branchPrefix` | `feat/` | Branch prefix (`feat/`, `fix/`, `chore/`) |

---

## Development

```bash
git clone https://github.com/luizhenriquesoares/trello-code-pilot.git
cd trello-code-pilot
npm install
npm run watch
# Press F5 in VS Code to launch Extension Development Host
```

---

## Roadmap

- [x] Full CI pipeline (Implement → Review → QA → Merge)
- [x] Project rules enforcement
- [x] Pipeline dashboard with card counts
- [x] Card detail webview
- [x] Auto-sync every 5 minutes
- [x] Claude Code IDE terminal integration
- [ ] Filter cards by label, member, or due date
- [ ] Custom prompt templates per label (e.g., "bug" vs "feature")
- [ ] Status bar showing active agents
- [ ] Webhook-based real-time sync (instead of polling)
- [ ] Support for Jira, Linear, GitHub Projects

---

## Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

## License

[MIT](LICENSE)
