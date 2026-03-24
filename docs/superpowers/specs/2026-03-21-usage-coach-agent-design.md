# Usage Coach Agent — Design Spec

## Overview

A live sidebar coach in Chugnus Command Center that watches active Claude Code sessions (both Command Center processes and external JSONL sessions), analyzes user-assistant exchanges as they happen, and surfaces actionable tips across three lenses: workflow efficiency, prompt quality, and strategic patterns.

## Requirements

### Functional

1. **Session watching**: Detect active Claude Code sessions by monitoring JSONL file writes and Command Center managed processes. Track new messages as they appear.
2. **Live analysis**: After each completed user-assistant exchange, send recent context to an LLM for coaching analysis. Use Opus via the local `llm-proxy` (Claude Pro subscription, no API cost).
3. **Three coaching lenses**:
   - **Workflow**: Spot inefficiencies, repeated mistakes, missed tools/skills, tasks taking longer than they should
   - **Prompt quality**: Identify vague requests, ambiguity causing wrong first attempts, unnecessary back-and-forth
   - **Strategic**: Cross-session patterns — project attention distribution, time allocation, productivity windows, recurring blockers
4. **Tip delivery**: Surface tips in a sidebar panel within the app. Each tip includes the session, exchange, and category that triggered it.
5. **Tip lifecycle**: Dismiss, save (persisted to memory system), or ignore. Deduplication prevents repeating the same advice within a session.
6. **Day summary**: Accumulate a running analysis across all sessions for the current day. Available as a collapsible digest in the coach panel.

### Non-Functional

- Coach is read-only. It watches session files and CC process logs. It never injects text into sessions or modifies files.
- Analysis latency under 10 seconds per exchange (Opus via proxy on localhost).
- Polling interval: 5 seconds for file-based sessions, real-time for CC managed processes (piggybacking on existing `cc:queue-update` events).
- Sliding context window: send the last 5 user-assistant exchanges per analysis call, not the full session transcript.
- Graceful degradation: if the proxy is unreachable, the coach disables itself and shows a "coach offline" badge. No crashes, no retries.

## Architecture

### Layer 1: Session Watcher (`electron/usage-coach/watcher.ts`)

Responsible for detecting active sessions and extracting new messages.

**Two input sources:**

1. **JSONL file watcher** — polls `~/.claude/projects/` every 5 seconds. A session is "active" if its file `mtime` is within the last 90 seconds. Tracks byte offset per file to read only new content.
2. **CC process tap** — subscribes to the existing `CCStreamMessage` flow from `command-center.ts` managed processes. Reconstructs user/assistant exchanges from the stream events.

**Output:** Emits `CoachExchange` events to the analyzer:

```typescript
interface CoachExchange {
  sessionId: string
  project: string           // friendly project name
  source: 'jsonl' | 'cc'   // which input source
  userMessage: string       // the user's prompt
  assistantMessage: string  // the assistant's response (truncated to 2000 chars)
  toolsUsed: string[]       // tool names from this exchange
  turnIndex: number         // exchange number within the session
  timestamp: string         // ISO timestamp
}
```

**CC stream subscription** — `command-center.ts` exposes a new EventEmitter-based hook:

```typescript
// command-center.ts additions
import { EventEmitter } from 'events'

const streamEmitter = new EventEmitter()

export function onStreamMessage(
  callback: (processId: string, msg: CCStreamMessage) => void
): () => void {
  streamEmitter.on('stream', callback)
  return () => streamEmitter.off('stream', callback)
}

// Called inside handleMessage() after pushing to fullLog:
streamEmitter.emit('stream', processId, msg)
```

**JSONL byte-offset reader** — implemented in `watcher.ts` (not `cli-logs.ts`, to keep that module clean). Uses `fs.createReadStream({ start: byteOffset })` with a readline interface, parses each JSONL line, and returns the new byte offset after reading:

```typescript
async function readJSONLFromOffset(
  filePath: string,
  startByte: number
): Promise<{ lines: any[]; newOffset: number }>
```

**State tracked per session:**

```typescript
interface WatchedSession {
  sessionId: string
  project: string
  source: 'jsonl' | 'cc'
  filePath?: string          // for JSONL sessions
  processId?: string         // for CC sessions
  byteOffset: number         // last read position in JSONL
  exchanges: CoachExchange[] // sliding window, keep last 8
  lastSeen: number           // timestamp of last activity
  tipsEmitted: Set<string>   // hashes for deduplication
}
```

**State persistence** — `WatchedSession.byteOffset` and `tipsEmitted` are persisted to the JSON database under `coachState.sessions: Record<sessionId, { byteOffset: number; tipsEmitted: string[] }>`. Flushed after each new tip or offset advance. On app restart, the watcher resumes from saved offsets and skips already-emitted tips.

### Layer 2: Coach Analyzer (`electron/usage-coach/analyzer.ts`)

Receives `CoachExchange` events and produces coaching tips.

**Analysis flow:**

1. Receive a new exchange from the watcher
2. Build a context window: the new exchange + up to 4 prior exchanges from the same session
3. Attach the day accumulator (running strategic summary, ~500 chars)
4. Send to Opus via `llm-proxy` at `http://localhost:8741/claude/v1/chat/completions`
5. Parse the structured response into tips
6. Deduplicate against `tipsEmitted` set for the session
7. Emit new tips to the renderer via IPC
8. Update the day accumulator with any strategic observations

**System prompt structure:**

```
You are a usage coach analyzing a user's interaction with Claude Code (an AI coding assistant).

CURRENT EXCHANGE:
[user message]
[assistant response]
[tools used: ...]

RECENT CONTEXT (prior exchanges in this session):
[exchange N-4 through N-1]

TODAY'S PATTERNS (accumulated across sessions):
[day accumulator summary]

Analyze this exchange across three lenses. Only produce a tip when you have something concrete and actionable. Do not force tips — returning zero tips is valid.

WORKFLOW lens: Could the user have used a different tool, skill, or approach? Did they repeat a known mistake? Is manual work happening that could be automated?

PROMPT lens: Was the request clear enough for a good first attempt? Did ambiguity cause wasted turns? Could the user have provided more context upfront?

STRATEGIC lens: Cross-session patterns — project switching, time of day, recurring blockers, neglected projects, productivity trends.

Respond in JSON:
{
  "tips": [
    {
      "category": "workflow" | "prompt" | "strategic",
      "severity": "info" | "suggestion" | "warning",
      "title": "short label (under 60 chars)",
      "body": "1-3 sentences of actionable advice",
      "reference": "quote the specific part of the exchange that triggered this"
    }
  ],
  "dayAccumulatorUpdate": "updated strategic summary incorporating this exchange (under 500 chars, or null if no change)"
}
```

**LLM call configuration:**

- Model: `claude-opus-4-6` via `http://localhost:8741/claude/v1/chat/completions`
- Max tokens: 1024 (tips are short)
- Temperature: 0.3 (consistent analysis, slight variation)
- No streaming needed — response is small, parse as a single JSON blob

**Day accumulator:**

- In-memory string, persisted to the JSON database under `coachState.dayAccumulator`
- Reset at midnight or when the user clears it
- Grows with each analysis call via `dayAccumulatorUpdate` from the LLM
- Capped at 1000 chars — the LLM is instructed to keep it under 500, but hard-truncate as a safety net

**Analysis queue:**

- One analysis call at a time, sequential processing
- Queue cap: 10 pending exchanges per session. If exceeded, drop the oldest queued exchange
- Per-analysis timeout: 15 seconds. On timeout, discard the call, log the error, move to next queued exchange
- If the analyzer is disabled mid-analysis, the in-flight call completes but its results are discarded

**Deduplication:**

- Hash each tip as `sha256(category + title + sessionId)` (truncated to 12 chars)
- Store in per-session `tipsEmitted` set, persisted to DB (see watcher state persistence above)
- A tip with a matching hash is silently dropped
- Strategic tips deduplicate across all sessions for the day using a separate `globalTipsEmitted` set on `coachState`

### Layer 3: Coach UI (`src/components/coach/`)

A sidebar panel accessible from the Command Center tab.

**Components:**

1. **CoachPanel** — main container. Collapsible sidebar on the right side of the Command Center tab. Toggle button in the tab header ("Coach" with a status indicator dot).
2. **CoachTipCard** — individual tip display. Shows: category badge (color-coded), severity icon, title, body, reference quote, timestamp, session name. Actions: dismiss (remove from view), save (persist to memory system), copy.
3. **CoachDaySummary** — collapsible section at the top showing the day accumulator as formatted text. Includes session count, tip count, and a "clear" button.
4. **CoachStatusBadge** — small indicator showing coach state: active (green pulse), analyzing (blue pulse), offline (gray), disabled (hidden).

**State management** — new Zustand store `src/store/coachStore.ts`:

`CoachTip` is a shared type in `src/types/index.ts` (used by both main and renderer):

```typescript
// src/types/index.ts additions
export interface CoachTip {
  id: string
  category: 'workflow' | 'prompt' | 'strategic'
  severity: 'info' | 'suggestion' | 'warning'
  title: string
  body: string
  reference: string
  sessionId: string
  project: string
  timestamp: string
  dismissed: boolean
  saved: boolean
}

export interface CoachDbState {
  dayAccumulator: string
  lastResetDate: string
  enabled: boolean
  globalTipsEmitted: string[]  // strategic tip hashes, reset daily
  sessions: Record<string, {
    byteOffset: number
    tipsEmitted: string[]
  }>
}
```

Store shape:

```typescript
interface CoachState {
  enabled: boolean
  status: 'active' | 'analyzing' | 'offline' | 'disabled'
  tips: CoachTip[]
  daySummary: string
  sessionCount: number
  panelOpen: boolean

  // Actions
  toggleEnabled: () => void
  togglePanel: () => void
  dismissTip: (id: string) => void
  saveTip: (id: string) => void
  clearDay: () => void
  addTips: (tips: CoachTip[]) => void
  setStatus: (status: CoachState['status']) => void
  setDaySummary: (summary: string) => void
}
```

**IPC channels:**

| Channel | Direction | Payload |
|---------|-----------|---------|
| `coach:tips` | main → renderer | `CoachTip[]` |
| `coach:status` | main → renderer | `{ status, sessionCount }` |
| `coach:day-summary` | main → renderer | `string` |
| `coach:toggle` | renderer → main | `{ enabled: boolean }` |
| `coach:save-tip` | renderer → main | `CoachTip` (saves to memory system) |
| `coach:clear-day` | renderer → main | `void` |

**Visual design:**

- Sidebar width: 320px, slides in from the right edge of the Command Center tab
- Background: surface-1, border-left: 1px surface-3
- Tip cards: surface-2 with left border colored by category (blue = workflow, purple = prompt, amber = strategic)
- Severity icons: info = circle-i, suggestion = lightbulb, warning = triangle
- Category badges use the existing `.badge-*` pill classes
- Follows the dark glassmorphic theme (surface-0 through surface-4)

## Data Flow

```
JSONL files ──poll 5s──▶ ┌─────────────┐
                          │   Watcher    │──CoachExchange──▶ ┌──────────────┐
CC processes ──events──▶  └─────────────┘                    │   Analyzer   │
                                                              │  (Opus via   │
                                                              │  llm-proxy)  │
                                                              └──────┬───────┘
                                                                     │ tips
                                                                     ▼
                                                              ┌──────────────┐
                                                              │  IPC bridge  │
                                                              └──────┬───────┘
                                                                     │
                                                                     ▼
                                                              ┌──────────────┐
                                                              │  Coach Panel │
                                                              │  (sidebar)   │
                                                              └──────────────┘
```

## File Structure

```
electron/
  usage-coach/
    watcher.ts        -- Session watcher (JSONL polling + CC tap)
    analyzer.ts       -- LLM analysis pipeline
    index.ts          -- init/shutdown, IPC handler registration
src/
  components/
    coach/
      CoachPanel.tsx       -- Main sidebar container
      CoachTipCard.tsx     -- Individual tip card
      CoachDaySummary.tsx  -- Day accumulator display
      CoachStatusBadge.tsx -- Status indicator
      index.ts             -- Barrel export
  store/
    coachStore.ts          -- Zustand store
electron/
  ipc/
    coach.ts               -- IPC handlers for coach channels
```

## Integration Points

### With existing systems

- **command-center.ts**: The watcher subscribes to `CCStreamMessage` events via the new `onStreamMessage()` export (defined in Layer 1 above). One new EventEmitter + one `emit()` call inside the existing `handleMessage()` function.
- **llm.ts**: The analyzer makes direct HTTP calls to `llm-proxy` at `localhost:8741`. This keeps the coach decoupled from the app's LLM provider settings and avoids consuming the user's API keys. Direct `http.request()` with 15-second timeout, no dependency on `streamLLM`.
- **memory system**: "Save tip" action calls `createMemory()` with `sourceType: 'coach'`, mapping the tip into the existing Memory format. Requires adding `'coach'` to the `sourceType` union in `src/types/index.ts` line 50.
- **database.ts**: Add `coachState: CoachDbState` to the root DB object. Auto-migrated on startup (missing field defaults to `{ dayAccumulator: '', lastResetDate: '', enabled: true, globalTipsEmitted: [], sessions: {} }`).
- **ipc/index.ts**: Import and call `registerCoachHandlers()` from the new `electron/ipc/coach.ts` module inside `registerAllHandlers()`.

### With main.ts

- Call `initCoach(mainWindow)` in the `app.whenReady()` chain, after `initCommandCenter(mainWindow)`.
- Call `destroyCoach()` in the `window-all-closed` handler.

### With preload.ts / ElectronAPI

Add the coach IPC channels to the preload bridge and the `ElectronAPI` interface:

```typescript
// New ElectronAPI methods
coachToggle: (enabled: boolean) => Promise<void>
coachSaveTip: (tip: CoachTip) => Promise<void>
coachClearDay: () => Promise<void>
onCoachTips: (callback: (tips: CoachTip[]) => void) => () => void
onCoachStatus: (callback: (data: { status: string; sessionCount: number }) => void) => () => void
onCoachDaySummary: (callback: (summary: string) => void) => () => void
```

## Edge Cases

1. **Proxy unreachable**: Analyzer catches connection errors, sets status to `offline`, stops sending analysis requests. Retries every 30 seconds with a lightweight ping. When proxy returns, status flips back to `active`.
2. **Rapid exchanges**: If a new exchange arrives while the previous analysis call is in-flight, queue it. Process queue sequentially (one analysis at a time) to avoid flooding the proxy.
3. **Large sessions**: The watcher only reads new bytes from JSONL files (tracks byte offset). Even a 50MB session file costs nothing to poll.
4. **Session ends**: When a JSONL file goes stale (mtime > 90s) or a CC process exits, the watcher marks the session inactive. Existing tips remain visible. The watched session state is cleaned up after 5 minutes of inactivity.
5. **Midnight rollover**: Day accumulator resets. Stored tips from the previous day remain visible until dismissed.
6. **Multiple sessions active**: The watcher tracks each independently. Tips are tagged with session ID so the UI can group or filter by session.
7. **Empty exchanges**: If the user sends a trivial message ("yes", "ok", "continue") the watcher still emits the exchange but the analyzer's system prompt allows returning zero tips.
8. **App restart**: Watcher resumes from persisted byte offsets in `coachState.sessions`. Deduplication sets are restored from DB, preventing duplicate tips for already-analyzed exchanges.
9. **Renderer crash/reload**: Tips in the Zustand store are lost, but main process re-sends current tip list via `coach:tips` on renderer reconnect (`did-finish-load` event). Deduplication state lives in main process memory + DB, unaffected by renderer crashes.
10. **Coach disabled mid-analysis**: In-flight LLM call completes but results are discarded. Queue is cleared. Watcher stops polling. Byte offsets are preserved so no re-analysis occurs when re-enabled.
11. **Proxy health ping**: `GET http://localhost:8741/` with 3-second timeout. On success, status flips from `offline` to `active`. Ping runs every 30 seconds only when status is `offline`.

## Verification

### Smoke Tests

1. Start the app with `llm-proxy` running. Open a Claude Code session in a terminal. Type a prompt. Within 15 seconds, a coaching tip appears in the Coach sidebar.
2. Launch a task from Command Center. The coach picks up the CC process stream and produces tips as the task runs.
3. Stop `llm-proxy`. The coach status badge turns gray ("offline"). Start the proxy again. Status returns to green within 30 seconds.
4. Dismiss a tip — it disappears. Save a tip — it appears in the Memories tab with `sourceType: 'coach'`.
5. Work across 3 sessions in one sitting. The day summary reflects patterns from all three.
6. Repeat the same mistake in two exchanges. The coach mentions it once, not twice (deduplication).

### Authority

- **auto**: Session watcher, analyzer pipeline, IPC bridge, coach store, tip card UI, database migration — all standard implementation with no architectural risk.
- **approval**: Adding `'coach'` to the Memory `sourceType` union (touches shared type), exposing `onStreamMessage()` from `command-center.ts` (touches public API), adding `CoachTip` and `CoachDbState` to shared types.
