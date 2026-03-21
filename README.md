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
