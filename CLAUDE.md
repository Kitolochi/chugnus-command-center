# Chugnus Command Center

Focused AI command center forked from mega-agenda — agent orchestration, knowledge management, smart queries, and CLI session analytics.

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Desktop**: Electron 28 (contextIsolation: true, nodeIntegration: false)
- **Build**: Vite + vite-plugin-electron
- **Database**: JSON file persisted via fs.writeFileSync (`%APPDATA%/chugnus-command-center/chugnus-command-center.json`)
- **AI**: Multi-provider LLM (Claude, ChatGPT, Gemini, Groq, OpenRouter) via `electron/llm.ts`
- **Embeddings**: @xenova/transformers (MiniLM-L6-v2, 384-dim local embeddings)
- **Search**: Hybrid — LanceDB vector search + MiniSearch BM25, merged via Reciprocal Rank Fusion (RRF)

## Architecture
- `electron/main.ts` -- Main process: BrowserWindow, IPC handlers, model loading
- `electron/preload.ts` -- Bridge: exposes `window.electronAPI` via contextBridge
- `electron/database.ts` -- JSON database with all CRUD operations
- `electron/llm.ts` -- Multi-provider LLM support (Claude, Gemini, Groq, OpenRouter)
- `electron/embeddings.ts` -- Local embedding model (Xenova/all-MiniLM-L6-v2)
- `electron/vector-store.ts` -- Hybrid search: LanceDB vector + BM25, RRF fusion, session indexing
- `electron/bm25-index.ts` -- MiniSearch BM25 full-text index with disk persistence
- `electron/session-parser.ts` -- Claude Code JSONL session parser (sessions → searchable chunks)
- `electron/knowledge-pack.ts` -- Knowledge compression, clustering, fact extraction
- `electron/memory.ts` -- Memory extraction from chat/CLI/journal sources
- `electron/smart-query.ts` -- RAG-powered Q&A streaming (hybrid search, transparent to consumers)
- `electron/agents.ts` -- Agent orchestration: heartbeat scheduler, session polling, cost aggregation
- `electron/command-center.ts` -- Command center process management
- `electron/ipc/` -- 8 handler modules registered via `registerAllHandlers()`
- `src/App.tsx` -- Root component with tab navigation
- `src/store/` -- Zustand stores: appStore, agentStore, sessionsStore, commandCenterStore
- `src/components/` -- UI components across layout, agents, command-center, sessions, settings, ui subdirectories
- `src/types/index.ts` -- Shared types including ElectronAPI interface
- `src/hooks/` -- Custom hooks (keyboard shortcuts, command palette, focus trap, IPC listener)

## Key Patterns
- All main<->renderer communication via IPC (invoke/handle pattern)
- Database is a single JSON file, auto-migrates missing fields on startup
- Models load in main process with 5s startup delay
- 7 tabs across 3 groups: Command (command-center), AI & Knowledge (agents, memories, sessions, context, lab), Settings
- Dark glassmorphic theme: surface-0 (#0c0c0e) through surface-4, accent colors in tailwind.config.cjs
- Fonts: Instrument Sans (display), DM Sans (body)
- Custom frameless window with `frame: false`, `show: false`, `ready-to-show` handler

## Commands
- `npm run dev` -- Start Vite dev server + Electron
- `npm run build` -- Production build (Vite + electron-builder)
- `npm run typecheck` -- TypeScript check (noEmit)
- `npm run lint` -- ESLint
- `npm run format` -- Prettier

## Tabs
- **Command Center** -- Queue, history, CLI sessions with resume, launch card
- **Agents** -- Agent orchestration, issues kanban, heartbeat scheduling, cost dashboard, run history
- **Memories** -- Memory extraction, topics, health monitoring, auto-pruning
- **Sessions** -- CLI session analytics, heatmap, search
- **Context** -- Smart query / RAG-powered Q&A, context file management
- **Lab** -- Knowledge pack compression, clustering, auditing
- **Settings** -- AI providers (Claude, ChatGPT, Gemini, Groq, OpenRouter), ChatGPT OAuth, keyboard shortcuts
