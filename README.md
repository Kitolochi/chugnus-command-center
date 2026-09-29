# Chugnus Command Center

AI command center for agent orchestration, knowledge management, smart queries, and CLI session analytics. Lives in your system tray.

Built with Electron 28 + React 18 + TypeScript + Tailwind CSS + Zustand.

## Tabs

| Group | Tab | Purpose |
|-------|-----|---------|
| Command | **Command Center** | Queue, history, CLI sessions with resume, launch card |
| AI & Knowledge | **Agents** | Agent orchestration, issues kanban, heartbeat scheduling, cost dashboard |
| AI & Knowledge | **Memories** | Memory extraction, topics, health monitoring, auto-pruning |
| AI & Knowledge | **Sessions** | CLI session analytics, heatmap, search |
| AI & Knowledge | **Context** | Smart query / RAG-powered Q&A, context file management |
| AI & Knowledge | **Lab** | Knowledge pack compression, clustering, auditing |
| Settings | **Settings** | AI providers, ChatGPT OAuth, keyboard shortcuts |

## Architecture

### Codex project sessions

The Command Center's **Codex** provider runs the installed Codex CLI directly with your existing `codex login` credentials and configuration. It does not require the local chat proxy.

- Select **Codex ? New Task**, choose or browse a project, enter a prompt, and click **Launch**. Codex and Claude tasks appear together in the same project queue, with the same focused and collapsed task cards. Codex can read/edit files and run commands in that directory.
- **Full log** shows messages and tool activity; completed edits and token usage are tracked. **Park**, **Done**, and **Kill** preserve distinct history states.
- Continue the same thread with follow-ups, run multiple tasks, stop a running turn, or park sessions in History and restore them later.
- Attach files with the paperclip or drag/drop. Supported images are passed as actual image input; other files are referenced by absolute path for Codex's tools.
- Model and effort dropdowns read the installed CLI?s live `model/list` and effective project `config/read` settings. Defaults show the actual configured values; effort choices follow the selected model. Change them at launch or on a task card for its next reply. These per-turn choices leave global configuration unchanged. Access defaults to **Edit project**; **Read only** and **Full access** are explicit alternatives. Noninteractive runs cannot display approval dialogs; operations outside the selected access policy are rejected.
- On Windows, if standard sandbox setup fails, enable **Windows compatibility sandbox**. This uses OpenAI's documented `windows.sandbox="unelevated"` fallback for this app's turns, preserves the selected access policy, and leaves global Codex configuration unchanged. See [OpenAI configuration guidance](https://learn.chatgpt.com/docs/config-file/config-basic#windows-sandbox-mode).

Session history is stored separately in `%APPDATA%/chugnus-command-center/codex-sessions.json`; underlying Codex threads remain in Codex's own session storage. History also discovers local Codex threads started outside the app, filters by project/date, and expands transcripts without starting a task. **Resume** restores a session to the shared queue. Imported transcripts show the latest 400 messages; Codex retains the full underlying thread. Claude's coach/analytics and Claude-specific slash commands are not included. Follow-ups are sent after a turn finishes or is stopped; mid-turn steering is not supported by this `codex exec` integration.

Codex uses the same saved-memory store as the rest of Chungus. Relevant memories are included in new turns, with their count shown under **Session details & memory**. **Extract memories** saves useful information from a transcript using the AI provider configured in Settings; the existing auto-generation setting also applies to completed Codex turns. Batch extraction includes recent Codex sessions. **Update knowledge search index** includes Codex transcripts alongside Claude history and context files in shared search. System instructions, reasoning, and tool payloads are excluded from transcript indexing.

`apache-arrow` is an explicit runtime dependency because LanceDB requires it in packaged builds; leaving it as an implicit peer dependency causes a JavaScript startup error in the Windows executable.

Set `CODEX_BINARY` to a native Codex executable if it cannot be discovered automatically. Protocol/lifecycle regression tests run with `npm test`.

```
electron/
  main.ts               # Entry point, BrowserWindow, tray, model loading
  preload.ts            # contextBridge (window.electronAPI)
  database.ts           # JSON DB with all CRUD operations
  secrets.ts            # Encrypted secret storage (Electron safeStorage)
  llm.ts                # Multi-provider LLM (Claude, ChatGPT, Gemini, Groq, OpenRouter)
  embeddings.ts         # Local embedding model (Xenova/all-MiniLM-L6-v2)
  vector-store.ts       # Hybrid search: LanceDB vector + BM25, RRF fusion
  bm25-index.ts         # MiniSearch BM25 full-text index with disk persistence
  session-parser.ts     # Claude Code JSONL session parser
  knowledge-pack.ts     # Knowledge compression, clustering, fact extraction
  memory.ts             # Memory extraction from chat/CLI/journal sources
  smart-query.ts        # RAG-powered Q&A streaming (hybrid search)
  agents.ts             # Agent orchestration: heartbeat scheduler, session polling
  command-center.ts     # Command center process management
  ipc/                  # 8 handler modules registered via registerAllHandlers()

src/
  App.tsx               # Root component with tab navigation
  store/                # Zustand stores (app, agent, sessions, commandCenter)
  components/           # UI organized by feature area
  hooks/                # Custom hooks (keyboard shortcuts, command palette, etc.)
  types/index.ts        # Shared types including ElectronAPI interface
```

### Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Desktop:** Electron 28 (contextIsolation: true, nodeIntegration: false)
- **State:** Zustand
- **Database:** JSON file persisted to `%APPDATA%/chugnus-command-center/`
- **Secrets:** Electron safeStorage (DPAPI on Windows, Keychain on macOS, libsecret on Linux)
- **AI:** Multi-provider LLM (Claude, ChatGPT, Gemini, Groq, OpenRouter) via `electron/llm.ts`
- **Embeddings:** @xenova/transformers with MiniLM-L6-v2 (384-dim, local)
- **Search:** Hybrid — LanceDB vector + MiniSearch BM25, merged via Reciprocal Rank Fusion

### Data Storage
- **JSON DB:** `%APPDATA%/chugnus-command-center/chugnus-command-center.json`
- **Encrypted secrets:** `%APPDATA%/chugnus-command-center/secrets.enc`
- **Context files:** `~/.claude/memory/` — markdown knowledge base with domain folders
- **Vector DB:** `%APPDATA%/chugnus-command-center/vector-db/`
- **BM25 index:** `%APPDATA%/chugnus-command-center/bm25-index.json`

### Window Management
- Frameless window with custom title bar
- System tray icon with context menu (Open, Quit)
- Single instance lock — second launch focuses existing window
- Hide on close (minimize to tray)

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/Kitolochi/chugnus-command-center.git
cd chugnus-command-center
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Vite dev server + Electron |
| `npm run build` | Production build (Vite + electron-builder) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run format` | Prettier |

### Optional Setup
- **Claude API Key** — Required for AI features. Set in Settings tab.
- **Multi-LLM Providers** — Configure Gemini, Groq, or OpenRouter as alternatives in Settings.
- **Claude Code CLI** — Required for command center task launching: `npm install -g @anthropic-ai/claude-code`

## Security

- Content Security Policy (CSP) headers — strict in production, relaxed for Vite HMR in dev
- Origin-restricted permission handler for media/clipboard/notifications
- API keys encrypted at rest via Electron safeStorage (OS credential store)
- Path traversal validation on all context file IPC handlers
- Shell command injection protection — CMD metacharacter escaping, validated URLs for shell.openExternal
- ASAR packaging enabled for production builds
