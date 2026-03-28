# MCP Dialog + Session Status Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-navigable MCP management modal triggered by `/mcp` and model/effort status pills to FocusCard headers.

**Architecture:** `CCQueueItem` gets `model?` and `effort?` fields propagated from launch opts. FocusCard renders pills from those fields and mounts a new `MCPDialog` component that runs `claude mcp list`, parses output into colored rows, and handles keyboard navigation and server actions (open in browser, reconnect, remove).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, Electron IPC (`ccExecShell`, `openExternal`), existing `Dialog` component.

**Spec:** `docs/superpowers/specs/2026-03-28-mcp-dialog-status-bar-design.md`

---

## File Map

| File                                          | Action | Responsibility                                                       |
| --------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `electron/command-center.ts`                  | Modify | Add `model?` + `effort?` to `CCQueueItem`, assign in `launchProcess` |
| `src/store/commandCenterStore.ts`             | Modify | Add `model?` + `effort?` to `CCQueueItem`                            |
| `src/components/command-center/MCPDialog.tsx` | Create | MCP list modal — parse, render, keyboard nav, actions                |
| `src/components/command-center/FocusCard.tsx` | Modify | Add status pills to header; replace `/mcp` handler; mount MCPDialog  |

---

## Task 1: Add model + effort to CCQueueItem in electron/command-center.ts

**Files:**

- Modify: `electron/command-center.ts:35-53` (CCQueueItem interface)
- Modify: `electron/command-center.ts:266-281` (item construction in launchProcess)

- [ ] **Step 1: Add fields to the CCQueueItem interface**

In `electron/command-center.ts`, the `CCQueueItem` interface starts at line 35. Add two optional fields after `lastActivityAt`:

```typescript
export interface CCQueueItem {
  processId: string
  sessionId?: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  status: 'working' | 'awaiting_input' | 'errored'
  resultText?: string
  errorMessage?: string
  pendingInput?: string
  filesChanged: string[]
  fullLog: CCStreamMessage[]
  costUsd: number
  turnCount: number
  startedAt: number
  updatedAt: number
  lastActivityAt: number
  model?: string
  effort?: string
}
```

- [ ] **Step 2: Assign model + effort when constructing the item in launchProcess**

In `launchProcess` (around line 266), the `item` object is constructed. Add `model` and `effort` from opts:

```typescript
const item: CCQueueItem = {
  processId,
  sessionId: opts.resumeSessionId,
  projectPath: effectiveCwd,
  projectName,
  projectColor,
  prompt: opts.prompt,
  status: 'working',
  filesChanged: [],
  fullLog: [],
  costUsd: 0,
  turnCount: 0,
  startedAt: Date.now(),
  updatedAt: Date.now(),
  lastActivityAt: Date.now(),
  model: opts.model,
  effort: opts.effort,
}
```

- [ ] **Step 3: Typecheck**

```bash
cd C:/Users/chris/chugnus-command-center && npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add electron/command-center.ts
git commit -m "feat(cc): store model and effort on CCQueueItem"
```

---

## Task 2: Add model + effort to CCQueueItem in commandCenterStore.ts

**Files:**

- Modify: `src/store/commandCenterStore.ts:4-22` (CCQueueItem interface)

- [ ] **Step 1: Add fields to the store-side CCQueueItem interface**

In `src/store/commandCenterStore.ts`, the `CCQueueItem` interface starts at line 4. Add the same two optional fields:

```typescript
export interface CCQueueItem {
  processId: string
  sessionId?: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  status: 'working' | 'awaiting_input' | 'errored'
  resultText?: string
  errorMessage?: string
  pendingInput?: string
  filesChanged: string[]
  fullLog: CCStreamMessage[]
  costUsd: number
  turnCount: number
  startedAt: number
  updatedAt: number
  lastActivityAt: number
  model?: string
  effort?: string
}
```

- [ ] **Step 2: Verify IPC propagation**

The IPC queue push uses `getLightQueue()` in `electron/command-center.ts` which spreads `{...m.item, fullLog: []}`. The `cc:get-queue` handler returns `getQueue()` which spreads the full item. Both paths include all fields automatically — no additional IPC wiring is needed.

Confirm by checking `electron/command-center.ts` lines 141-146 (`getLightQueue`) and `electron/ipc/command-center.ts` line 128 (`cc:get-queue`). Both use spreads, so `model`/`effort` will reach the renderer as soon as they're on the item.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/commandCenterStore.ts
git commit -m "feat(store): add model and effort fields to CCQueueItem"
```

---

## Task 3: Build MCPDialog component

**Files:**

- Create: `src/components/command-center/MCPDialog.tsx`

- [ ] **Step 1: Create the file with types and parser**

Create `src/components/command-center/MCPDialog.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import Dialog from '../ui/Dialog'
import { Loader2, RefreshCw, ExternalLink, Trash2 } from 'lucide-react'

interface MCPServer {
  name: string
  url: string
  status: 'connected' | 'needs_auth' | 'failed' | 'unknown'
  rawLine: string
}

function parseMcpList(stdout: string): MCPServer[] {
  const servers: MCPServer[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Expected: "✓ name (status)   url" or "! name (status)   url" or "✗ name (status)   url"
    const match = trimmed.match(/^([✓!✗])\s+(\S+)\s+\(([^)]+)\)\s+(\S+)$/)
    if (!match) continue
    const [, symbol, name, , url] = match
    let status: MCPServer['status'] = 'unknown'
    if (symbol === '✓') status = 'connected'
    else if (symbol === '!') status = 'needs_auth'
    else if (symbol === '✗') status = 'failed'
    servers.push({ name, url, status, rawLine: trimmed })
  }
  return servers
}

function statusColor(status: MCPServer['status']): string {
  if (status === 'connected') return 'text-accent-emerald'
  if (status === 'needs_auth') return 'text-accent-amber'
  if (status === 'failed') return 'text-red-400'
  return 'text-white/50'
}

function statusSymbol(status: MCPServer['status']): string {
  if (status === 'connected') return '✓'
  if (status === 'needs_auth') return '!'
  if (status === 'failed') return '✗'
  return '?'
}

interface MCPDialogProps {
  open: boolean
  onClose: () => void
  projectPath: string
}

export default function MCPDialog({ open, onClose, projectPath }: MCPDialogProps) {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [actionRunning, setActionRunning] = useState(false)

  const cwd = projectPath || (typeof process !== 'undefined' ? process.env.USERPROFILE || '~' : '~')

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.ccExecShell({ command: 'claude mcp list', cwd })
      if (result.code !== 0 && result.stderr) {
        setError(result.stderr)
        setServers([])
      } else {
        const parsed = parseMcpList(result.stdout)
        setServers(parsed)
        setSelectedIndex(0)
      }
    } catch (err: any) {
      setError(err.message)
      setServers([])
    }
    setLoading(false)
  }, [cwd])

  useEffect(() => {
    if (open) fetchList()
  }, [open, fetchList])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (servers.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % servers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + servers.length) % servers.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handlePrimaryAction(servers[selectedIndex])
    }
  }

  const handlePrimaryAction = async (server: MCPServer) => {
    if (server.status === 'needs_auth') {
      window.electronAPI.openExternal(server.url)
    } else if (server.status === 'failed') {
      await fetchList()
    } else if (server.status === 'connected') {
      await handleRemove(server.name)
    }
  }

  const handleRemove = async (name: string) => {
    setActionRunning(true)
    try {
      await window.electronAPI.ccExecShell({ command: `claude mcp remove ${name}`, cwd })
      await fetchList()
    } catch {}
    setActionRunning(false)
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div
        className="bg-surface-1 border border-white/[0.08] rounded-xl w-[480px] max-w-[90vw] p-5 shadow-2xl"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-white/80 font-mono">/mcp — MCP Servers</span>
          <button
            onClick={fetchList}
            disabled={loading}
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-white/30">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-[11px] text-red-400 font-mono whitespace-pre-wrap">{error}</p>
            </div>
            <button
              onClick={fetchList}
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && servers.length === 0 && (
          <p className="text-[11px] text-white/40 text-center py-6">No MCP servers configured</p>
        )}

        {!loading && !error && servers.length > 0 && (
          <div className="space-y-1">
            {servers.map((server, i) => {
              const isSelected = i === selectedIndex
              return (
                <div
                  key={server.name}
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-surface-3' : 'hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-mono text-sm font-bold shrink-0 ${statusColor(server.status)}`}>
                      {statusSymbol(server.status)}
                    </span>
                    <span className="text-[12px] text-white/80 font-mono truncate">{server.name}</span>
                    <span className="text-[10px] text-white/30 truncate hidden sm:block">{server.url}</span>
                  </div>

                  {isSelected && !actionRunning && (
                    <div className="flex items-center gap-1 shrink-0">
                      {server.status === 'needs_auth' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.electronAPI.openExternal(server.url) }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-accent-amber hover:bg-accent-amber/10 transition-colors"
                        >
                          <ExternalLink size={10} /> Open in Browser
                        </button>
                      )}
                      {server.status === 'failed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); fetchList() }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/50 hover:bg-white/[0.05] transition-colors"
                        >
                          <RefreshCw size={10} /> Reconnect
                        </button>
                      )}
                      {server.status === 'connected' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(server.name) }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 size={10} /> Remove
                        </button>
                      )}
                    </div>
                  )}

                  {isSelected && actionRunning && (
                    <Loader2 size={10} className="animate-spin text-white/30 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer hint */}
        {servers.length > 0 && (
          <p className="mt-3 text-[9px] text-white/20 font-mono">↑↓ navigate  ↵ action  esc close</p>
        )}
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/command-center/MCPDialog.tsx
git commit -m "feat(cc): add MCPDialog component with keyboard nav and server actions"
```

---

## Task 4: Wire MCPDialog + status pills into FocusCard

**Files:**

- Modify: `src/components/command-center/FocusCard.tsx`

- [ ] **Step 1: Add mcpDialogOpen state and MCPDialog import**

At the top of `FocusCard.tsx`, add the import:

```typescript
import MCPDialog from './MCPDialog'
```

Inside the `FocusCard` function body, after the existing state declarations (around line 50), add:

```typescript
const [mcpDialogOpen, setMcpDialogOpen] = useState(false)
```

- [ ] **Step 2: Replace the /mcp handler to open the dialog**

Find line 126:

```typescript
if (name === 'mcp') {
  await runCli('claude mcp list', '/mcp')
  return true
}
```

Replace with:

```typescript
if (name === 'mcp') {
  setMcpDialogOpen(true)
  setResponse('')
  return true
}
```

- [ ] **Step 3: Add model/effort status pills to the header**

The header block starts around line 408. Add a `MODEL_LABELS` map and pill row after the status label line. Find this block:

```typescript
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant={
              (['blue', 'purple', 'red', 'amber'] as const).includes(item.projectColor as any)
                ? (item.projectColor as 'blue' | 'purple' | 'red' | 'amber')
                : item.projectColor === 'green' ? 'emerald' : 'default'
            }>
              {item.projectName}
            </Badge>
            <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
            {item.status === 'working' && !isStale && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
            {isStale && <AlertTriangle size={10} className="text-accent-amber" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30">${item.costUsd.toFixed(2)}</span>
            <span className="text-[9px] text-white/20">{Math.round((Date.now() - item.startedAt) / 60000)}m ago</span>
          </div>
        </div>
```

Replace with:

```typescript
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={
              (['blue', 'purple', 'red', 'amber'] as const).includes(item.projectColor as any)
                ? (item.projectColor as 'blue' | 'purple' | 'red' | 'amber')
                : item.projectColor === 'green' ? 'emerald' : 'default'
            }>
              {item.projectName}
            </Badge>
            <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
            {item.status === 'working' && !isStale && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
            {isStale && <AlertTriangle size={10} className="text-accent-amber" />}
            {(item.model || item.effort) && (
              <div className="flex items-center gap-1">
                {item.model && (
                  <span className="bg-surface-2 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[10px] text-white/40 font-mono">
                    {MODEL_LABELS[item.model] ?? item.model.slice(0, 12)}
                  </span>
                )}
                {item.effort && (
                  <span className="bg-surface-2 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[10px] text-white/40 font-mono">
                    {item.effort.charAt(0).toUpperCase() + item.effort.slice(1)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30">${item.costUsd.toFixed(2)}</span>
            <span className="text-[9px] text-white/20">{Math.round((Date.now() - item.startedAt) / 60000)}m ago</span>
          </div>
        </div>
```

- [ ] **Step 4: Add MODEL_LABELS constant**

Near the top of the file (after imports, before the `AttachmentChip` component), add:

```typescript
const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-5-20250929': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
}
```

- [ ] **Step 5: Mount MCPDialog at the bottom of FocusCard's JSX**

The FocusCard returns a `<div className="relative">` wrapper. At the very bottom of the JSX, just before the final closing `</div>`, add:

```tsx
<MCPDialog open={mcpDialogOpen} onClose={() => setMcpDialogOpen(false)} projectPath={item.projectPath ?? ''} />
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/command-center/FocusCard.tsx
git commit -m "feat(cc): wire MCPDialog and model/effort status pills into FocusCard"
```

---

## Task 5: Smoke test

- [ ] **Step 1: Start the app**

```bash
npm run dev
```

- [ ] **Step 2: Verify status pills**

Launch a task. Confirm the FocusCard header shows `[Sonnet]` and `[High]` (or whatever model/effort was set) pills alongside the project name badge.

- [ ] **Step 3: Verify /mcp dialog opens**

Type `/mcp` in a FocusCard prompt and press Enter. Confirm the MCP modal opens (not the old shell output box).

- [ ] **Step 4: Verify keyboard navigation**

Arrow keys should move the highlight. Enter should trigger the primary action on the selected row. Escape should close.

- [ ] **Step 5: Verify empty state**

If no MCP servers are configured, confirm "No MCP servers configured" message appears.

- [ ] **Step 6: Final commit**

```bash
git add -A && git commit -m "chore: smoke test complete — MCP dialog + status bar done"
git push
```
