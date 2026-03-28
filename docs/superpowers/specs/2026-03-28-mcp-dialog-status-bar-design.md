# MCP Dialog + Session Status Bar Design

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Two UI features for FocusCard in Chugnus Command Center

---

## Feature 1: MCP Management Dialog

### Purpose

When the user types `/mcp` in a FocusCard prompt box, open a modal dialog that replicates Claude Code's terminal `/mcp` UI — color-coded server status, keyboard navigation, and inline actions.

### Trigger

The `/mcp` handler in `FocusCard.tsx` currently runs `claude mcp list` and prints raw output to the shell output box. Replace that behavior with setting `mcpDialogOpen: true` in local state.

### Component: `MCPDialog.tsx`

New component at `src/components/command-center/MCPDialog.tsx`. Wraps the existing `Dialog` component from `src/components/ui/` (which handles `Escape` and full-screen backdrop).

**Props:**

- `open: boolean`
- `onClose: () => void`
- `projectPath: string` — cwd for shell commands; falls back to `process.env.USERPROFILE` or `~` if empty

**Data flow:**

1. On open, run `claude mcp list` via `ccExecShell` in `projectPath` (or home dir fallback)
2. Parse stdout into `MCPServer[]`
3. Render list; re-run on "Reconnect"

### Parsing `claude mcp list` output

The output format per line:

```
✓ server-name (connected)         https://...
! server-name (needs auth)        https://...
✗ server-name (failed)            https://...
```

Parse: leading symbol → status category, first word after symbol → name, last whitespace-separated token → URL.

Lines that don't match the pattern are skipped silently. If zero valid lines are parsed after a successful command (exit 0), show empty state: "No MCP servers configured."

If the command exits non-zero or throws, show an error message with the stderr content.

**Status color mapping:**

- `✓` or line contains `connected` → `text-accent-emerald`
- `!` or line contains `auth` → `text-accent-amber`
- `✗` or line contains `failed` or `error` → `text-red-400`
- Unknown → `text-white/50`

### Keyboard navigation

Handled via `onKeyDown` on the inner content container (not competing with Dialog's Escape handler since Dialog wraps the whole component):

- `ArrowUp` / `ArrowDown` — move `selectedIndex`; wraps at boundaries
- `Enter` — trigger primary action on selected row
- Tab navigation works normally (Dialog handles focus trap)

### Actions per server

| Status     | Primary Action             | Label             |
| ---------- | -------------------------- | ----------------- |
| connected  | Remove server              | "Remove"          |
| needs auth | Open server URL in browser | "Open in Browser" |
| failed     | Refresh list               | "Reconnect"       |

**"Open in Browser"**: calls `window.electronAPI.openExternal(url)` with the parsed server URL. Named "Open in Browser" (not "Authenticate") because the URL is the server base URL, not a guaranteed OAuth endpoint — the user completes auth in the browser.

**"Reconnect"** / **"Refresh"**: re-runs `claude mcp list` and replaces the parsed list.

**"Remove"**: runs `claude mcp remove <name>` via `ccExecShell`, then re-runs `claude mcp list` to refresh.

### Loading & error states

- **Loading**: small spinner (existing `Loader` or inline CSS animation) centered in the list area, visible while `claude mcp list` is running
- **Error**: red-tinted text block showing stderr content + a "Retry" button
- **Empty**: `text-white/40` message: "No MCP servers configured"

### Integration in FocusCard

Add `mcpDialogOpen` local state (boolean). In the `/mcp` slash command handler, set `mcpDialogOpen(true)` instead of printing shell output. Mount `<MCPDialog>` at the bottom of the FocusCard JSX:

```tsx
<MCPDialog open={mcpDialogOpen} onClose={() => setMcpDialogOpen(false)} projectPath={item.projectPath ?? ''} />
```

---

## Feature 2: Session Status Bar

### Purpose

Show the active model and effort level at a glance in each FocusCard header.

### Location

Slim pill row in the FocusCard header, to the left of the action buttons (Kill / Park / Done).

### Data source

`CCQueueItem` and `CCProcess` in `electron/command-center.ts` currently do **not** store `model` or `effort`. These fields must be added:

**`electron/command-center.ts`** — add to `CCProcess`:

```typescript
model?: string
effort?: string
```

Assign from `opts.model` and `opts.effort` in `launchProcess`.

**`src/store/commandCenterStore.ts`** — add to `CCQueueItem`:

```typescript
model?: string
effort?: string
```

Map from the IPC queue response.

**`src/types/index.ts`** — if `CCQueueItem` is declared here, add the same optional fields.

### Display

Model label map (fallback: show first 12 chars of raw model ID):

```
claude-opus-4-6             → Opus
claude-sonnet-4-5-20250929  → Sonnet
claude-haiku-4-5-20251001   → Haiku
```

Effort: capitalize first letter (`high` → `High`).

Pills only render when the field is present. If both are absent (older queue items), the pill row is hidden entirely.

**Pill styling:**

```
[Sonnet] [High]
```

`bg-surface-2 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[10px] text-white/40 font-mono`

---

## Files Changed

| File                                          | Change                                                      |
| --------------------------------------------- | ----------------------------------------------------------- |
| `src/components/command-center/MCPDialog.tsx` | New component                                               |
| `src/components/command-center/FocusCard.tsx` | Replace `/mcp` handler; add status pills; mount MCPDialog   |
| `electron/command-center.ts`                  | Add `model?` + `effort?` to `CCProcess`, populate from opts |
| `src/store/commandCenterStore.ts`             | Add `model?` + `effort?` to `CCQueueItem`, map from IPC     |
| `src/types/index.ts`                          | Add `model?` + `effort?` to `CCQueueItem` if declared here  |

---

## Verification

1. Type `/mcp` in a FocusCard → modal opens (no raw shell output)
2. Server list renders with color-coded status symbols
3. Arrow keys move the selection highlight; wraps at top/bottom
4. "Open in Browser" on an auth-needed server opens the browser
5. "Reconnect" on a failed server refreshes the list
6. "Remove" on a connected server removes it and refreshes
7. Empty list → "No MCP servers configured" message
8. Command failure → error state with stderr + Retry button
9. Escape closes the modal (via Dialog component)
10. FocusCard header shows `[Sonnet] [High]` pills for sessions with model/effort set
11. Pills absent for sessions without model/effort
12. Unknown model ID shows first 12 chars of raw ID
