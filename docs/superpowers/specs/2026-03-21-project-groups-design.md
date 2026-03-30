# Project Groups — Design Spec

## Overview

Replace the flat Command Center queue with a two-level project navigation: a Projects Overview landing page showing project cards with task counts and activity, and project-scoped queue views for drilling into individual projects. Collab and Codex tabs remain globally accessible.

## Requirements

### Functional

1. **Projects Overview (default landing)**: Grid of project cards — one per project with active queue items. Each card shows: project name, color accent bar, task count badges (working, awaiting, errored), last prompt snippet (from the most recently updated task by `lastActivityAt`), last activity timestamp.
2. **Project card actions**: Click card body to drill into project queue. "+" button to launch new task for that project (pre-fills LaunchCard with `projectPath`). Existing header-level "New Task" button stays unchanged (opens LaunchCard with full project picker).
3. **Project Queue (drill-in view)**: Back arrow + project name header. Same FocusCard + CollapsedCard pattern, filtered to that project's tasks. "New Task" button pre-scoped to this project.
4. **Queue sorting**: Same as existing — awaiting_input → errored → working — just filtered by `projectPath` when drilled in.
5. **View scoping**: When `selectedProject` is set, the Queue view shows only that project's tasks and the History view auto-filters to that project's entries. When `selectedProject` is null, Queue shows ProjectsOverview and History shows global history.
6. **Empty states**: "No active projects" on overview with launch button. "All tasks complete" on project queue with back link.
7. **Collab/Codex tabs**: Accessible at both levels (global, not project-scoped). Switching to Collab/Codex preserves `selectedProject` — returning to Queue/History restores the project context.

### Non-Functional

- No backend changes — all data fields (`projectPath`, `projectName`, `projectColor`) already exist on `CCQueueItem`.
- No IPC changes — existing `onCCQueueUpdate` provides full queue, filtering happens in renderer.
- No database schema changes — grouping is purely UI-driven.
- Responsive layout: 1 column on narrow, 2 columns on wider viewports.

## Architecture

### State Management

Add to `commandCenterStore.ts`:

```typescript
selectedProject: string | null       // projectPath or null for overview
launchPrefilledProject: string | null // pre-fill LaunchCard with this project path

selectProject: (path: string) => void
deselectProject: () => void           // clears selectedProject AND focusId
setLaunchPrefilledProject: (path: string | null) => void
```

**Navigation rules:**
- `selectProject(path)` sets `selectedProject` to path, clears `focusId` (the project queue will auto-focus its own top priority item).
- `deselectProject()` sets `selectedProject` to null, clears `focusId`.
- Switching `activeView` between 'queue' and 'history' preserves `selectedProject`. Only the back button or `deselectProject()` clears it.
- `activeView` switching to 'collab' or 'codex' preserves `selectedProject`. Switching back to 'queue' or 'history' restores project context.

**History integration:**
- When `selectedProject` is set and `activeView === 'history'`, set `historyFilter` to `selectedProject` and hide the project filter dropdown in HistoryView.
- When `selectedProject` is null, `historyFilter` behaves normally (user-controlled dropdown).

### Component Structure

**New components** (`src/components/command-center/`):

1. **ProjectCard.tsx** — Individual project card for overview grid
   - Props: `project: { path: string; name: string; color: string; workingCount: number; awaitingCount: number; erroredCount: number; lastPrompt: string; lastActivity: number }`
   - Actions: onClick body → `selectProject(path)`, "+" button → `setLaunchPrefilledProject(path)` then `setLaunchOpen(true)` (with `stopPropagation`)
   - Visual: surface-2 bg, 4px left border colored by `project.color`, hover → surface-3, transition-colors

2. **ProjectsOverview.tsx** — Grid layout of project cards
   - Derives project list from `queue` by grouping on `projectPath`: for each group, count by status, find max `lastActivityAt`, take `prompt` from task with max `lastActivityAt`
   - Renders empty state if no active queue items
   - No duplicate "New Task" button — the existing header button handles global launches

**Modified components**:

3. **CommandCenter.tsx** — Conditional rendering based on `selectedProject`
   - When `selectedProject === null` AND `activeView === 'queue'` → render `<ProjectsOverview />`
   - When `selectedProject !== null` AND `activeView === 'queue'` → render back button header + filtered FocusCard/CollapsedCard list
   - When `activeView === 'history'` → render HistoryView (which reads `selectedProject` for auto-filtering)
   - Back button in project queue header: `← {projectName}`, clickable, `hover:bg-surface-3`, onClick → `deselectProject()`

4. **LaunchCard.tsx** — Read `launchPrefilledProject` from store to pre-fill project path. User can still change it. Clear `launchPrefilledProject` when LaunchCard closes.

5. **HistoryView.tsx** — Accept `selectedProject` as a prop or read from store. When set, override `historyFilter` to `selectedProject` and hide the project filter dropdown.

**Unchanged components**:

- FocusCard.tsx, CollapsedCard.tsx, PomodoroWidget.tsx, CollabView.tsx, CodexChatView.tsx

### Data Flow

1. IPC `onCCQueueUpdate` → `commandCenterStore.queue` updates → re-render
2. ProjectsOverview groups queue by `projectPath`, derives counts per status, last activity, last prompt snippet
3. User clicks project card → `selectProject(path)` → CommandCenter switches to filtered queue view
4. Filtered queue: `queue.filter(item => item.projectPath === selectedProject)`
5. User clicks back → `deselectProject()` → CommandCenter switches to ProjectsOverview
6. User clicks "+" on card → `setLaunchPrefilledProject(path)` + `setLaunchOpen(true)` → LaunchCard opens pre-filled

No new IPC calls, no main process changes.

## Visual Design

### Projects Overview

- Grid: `grid grid-cols-1 md:grid-cols-2 gap-3`
- No extra header — the existing CommandCenter header with "New Task" button serves as the overview header
- Empty state: centered card with "No active projects" + launch button (reuse existing EmptyState component)

### Project Card

- Background: surface-2, hover → surface-3, transition-colors, rounded-lg, cursor-pointer
- Left border: 4px solid `project.color` (from `CCQueueItem.projectColor`)
- Padding: p-4
- Layout:
  - Top row: project name (`text-sm font-semibold text-white/90`) + "+" button (right, ghost style, `stopPropagation`)
  - Badge row: `flex gap-2 mt-2` — working count (badge-emerald), awaiting count (badge-amber), errored count (badge-red, shown only if > 0)
  - Last prompt: `mt-2 text-xs text-white/40 truncate` (single line, 80 char CSS truncation via Tailwind `truncate`)
  - Footer: `mt-2 text-[10px] text-white/25 font-mono` — relative timestamp ("2m ago", "1h ago")

### Project Queue Header (drill-in)

- Replace the "Command Center" title + status badges with: back button + project name + status badges (filtered counts)
- Back button: `← {projectName}` in a `flex items-center gap-2` row. Arrow icon: `text-white/40`. Project name: `text-sm font-semibold text-white/90`. Entire row is clickable with `hover:text-white/60 transition-colors cursor-pointer`.
- The view toggle tabs (Queue/History/Collab/Codex) and "New Task" button remain in the same position.

### Color Scheme

- Follows dark glassmorphic theme (surface-0 through surface-4)
- Accent colors from project's `projectColor` field
- Badge variants: badge-emerald (working), badge-amber (awaiting), badge-red (errored)

## Edge Cases

1. **All tasks for a project complete while viewing it** — stay on project queue view, show "All tasks complete" empty state with back link. Don't auto-navigate.
2. **New task arrives for a project while on overview** — project card updates live (counts, last activity) via queue re-render.
3. **New task arrives for a new project** — new project card appears in grid.
4. **Project has only history, no active tasks** — don't show on overview (overview derives from active queue items). History-only projects accessible via History tab when `selectedProject` is null.
5. **Single project active** — still shows overview with one card. No auto-drill-in.
6. **LaunchCard opened from project queue** — `launchPrefilledProject` is set to `selectedProject`, pre-filling the project path. User can change it. `launchPrefilledProject` clears when LaunchCard closes.
7. **Queue update while drilled in, selected project's tasks all complete** — show empty state in project queue view.
8. **Drilled into project, then navigate to Collab/Codex tab** — `selectedProject` persists. Returning to Queue view shows the project queue. User clicks back button to return to overview.
9. **focusId during navigation** — `selectProject()` clears `focusId` so the project queue auto-focuses its top priority task. `deselectProject()` also clears `focusId`. This prevents stale focus references across project switches.
10. **History view while drilled in** — `historyFilter` auto-set to `selectedProject`, filter dropdown hidden. Back button still visible in header (same as queue view).
11. **Pomodoro widget** — always visible regardless of selectedProject or activeView (stays above the header).

## Verification

### Smoke Tests

1. App starts → Projects Overview shows one card per project with active tasks.
2. Launch 3 tasks across 2 projects → 2 project cards appear with correct counts.
3. Click a project card → drills into that project's queue with only its tasks.
4. Click back arrow → returns to Projects Overview, focusId cleared.
5. "+" on a project card → LaunchCard opens with project pre-filled.
6. Dismiss all tasks for a project while drilled in → empty state with back link appears.
7. New task arrives via IPC → project card updates live / new card appears.
8. Collab and Codex tabs accessible from both levels.
9. Drill into project, switch to History → shows only that project's history entries, filter dropdown hidden.
10. Return to overview, open History → shows global history, filter dropdown visible.
11. Drill into project, switch to Codex, switch back to Queue → project queue still showing (selectedProject preserved).

### Authority

- **auto**: ProjectCard component, ProjectsOverview component, CommandCenter conditional rendering, commandCenterStore state additions, LaunchCard pre-fill, HistoryView auto-filter — standard UI work with no architectural risk.
- **approval**: None — this feature adds UI components and store state without touching backend, IPC, database, or shared types.
