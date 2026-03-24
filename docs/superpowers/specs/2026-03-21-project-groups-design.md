# Project Groups — Design Spec

## Overview

Replace the flat Command Center queue with a two-level project navigation: a Projects Overview landing page showing project cards with task counts and activity, and project-scoped queue views for drilling into individual projects. Collab and Codex tabs remain globally accessible.

## Requirements

### Functional

1. **Projects Overview (default landing)**: Grid of project cards — one per project with active tasks. Each card shows: project name, color accent bar, task count badges (N active, N awaiting), last prompt snippet, last activity timestamp.
2. **Project card actions**: Click to drill into project queue. "+" button to launch new task for that project. Global "New Task" button opens existing LaunchCard with full project picker.
3. **Project Queue (drill-in view)**: Back arrow + project name header. Same FocusCard + CollapsedCard pattern, filtered to that project's tasks. "New Task" button pre-scoped to this project.
4. **Queue sorting**: Same as existing — awaiting_input → errored → working — just filtered by `projectPath` when drilled in.
5. **Sub-tabs**: Queue/History sub-tabs scoped to the drilled-in project. On overview, History is global.
6. **Empty states**: "No active projects" on overview with launch button. "All tasks complete" on project queue with back link.
7. **Collab/Codex tabs**: Accessible at overview level (global, not project-scoped).

### Non-Functional

- No backend changes — all data fields (`projectPath`, `projectName`, `projectColor`) already exist on `CCQueueItem`.
- No IPC changes — existing `onCCQueueUpdate` provides full queue, filtering happens in renderer.
- No database schema changes — grouping is purely UI-driven.
- Responsive layout: 1 column on narrow, 2 columns on wider viewports.

## Architecture

### State Management

Add to `commandCenterStore.ts`:

```typescript
selectedProject: string | null  // projectPath or null for overview
selectProject: (path: string) => void
deselectProject: () => void
```

Existing queue, sorting, and focus logic unchanged — filter by `projectPath` when `selectedProject` is set.

### Component Structure

**New components** (`src/components/command-center/`):

1. **ProjectCard.tsx** — Individual project card for overview grid
   - Props: `project: { path: string; name: string; color: string; taskCount: number; awaitingCount: number; lastPrompt: string; lastActivity: string }`
   - Actions: onClick → `selectProject(path)`, "+" button → `openLaunch(path)`
   - Visual: surface-2 bg, left border colored by `project.color`, hover → surface-3

2. **ProjectsOverview.tsx** — Grid layout of project cards
   - Derives project list from `queue` by grouping on `projectPath`
   - Renders empty state if no active projects
   - Global "New Task" button at top → `openLaunch(null)` (opens LaunchCard with full picker)

**Modified component**:

3. **CommandCenter.tsx** — Conditional rendering based on `selectedProject`
   - If `selectedProject === null` → render `<ProjectsOverview />`
   - If `selectedProject !== null` → render existing queue view with back button header
   - Back button: left arrow icon + project name, surface-2 pill style, onClick → `deselectProject()`

**Unchanged components**:

- FocusCard.tsx, CollapsedCard.tsx, HistoryView.tsx, LaunchCard.tsx, PomodoroWidget.tsx, CollabView.tsx, CodexChatView.tsx

### Data Flow

1. IPC `onCCQueueUpdate` → `commandCenterStore.queue` updates → re-render
2. ProjectsOverview groups queue by `projectPath`, derives counts, last activity, last prompt snippet
3. User clicks project card → `selectProject(path)` → CommandCenter switches to filtered queue view
4. Filtered queue: `queue.filter(item => item.projectPath === selectedProject)`
5. User clicks back → `deselectProject()` → CommandCenter switches to ProjectsOverview

No new IPC calls, no main process changes.

## Visual Design

### Projects Overview

- Grid: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Header: "Active Projects" (surface-2 pill, left side) + "New Task" button (right side)
- Empty state: centered card with "No active projects" + launch button

### Project Card

- Background: surface-2, hover → surface-3
- Left border: 4px solid `project.color` (from `CCQueueItem.projectColor`)
- Layout:
  - Top row: project name (text-lg font-display) + "+" button (right)
  - Badge row: active count (badge-blue), awaiting count (badge-amber), errored count (badge-red if > 0)
  - Last prompt: truncated to 80 chars, text-dim, text-sm
  - Footer: last activity timestamp (text-xs text-dim-more)
- Badge pills: existing `.badge-*` classes (blue for active, amber for awaiting, red for errored)

### Project Queue (drill-in)

- Header bar: back button (left arrow + project name, surface-2 pill) + "New Task" button (right)
- Back button: `← {projectName}` (text-sm font-display)
- Queue list: identical to existing, filtered by `projectPath`
- Empty state: "All tasks complete" with back link

### Color Scheme

- Follows dark glassmorphic theme (surface-0 through surface-4)
- Accent colors from project's `projectColor` field
- Badge variants: badge-blue, badge-amber, badge-emerald, badge-red

## Edge Cases

1. **All tasks for a project complete while viewing it** — stay on project queue view, show "All tasks complete" empty state with back link. Don't auto-navigate.
2. **New task arrives for a project while on overview** — project card updates live (counts, last activity).
3. **New task arrives for a new project** — new project card appears in grid.
4. **Project has only history, no active tasks** — don't show on overview. History-only projects accessible via History tab.
5. **Single project active** — still shows overview with one card. No auto-drill-in.
6. **LaunchCard opened from project queue** — pre-fills `projectPath`, user can still change it.
7. **Queue update while drilled in, selected project's tasks all complete** — show empty state in project queue view.
8. **Drilled into project, then navigate to Collab/Codex tab** — `selectedProject` persists. Returning to Command Center tab shows the project queue, not overview. Add "Back to Overview" link in header.
9. **History sub-tab on overview** — shows global history across all projects. History sub-tab on project queue — shows only that project's history.

## Verification

### Smoke Tests

1. App starts → Projects Overview shows one card per project with active tasks.
2. Launch 3 tasks across 2 projects → 2 project cards appear with correct counts.
3. Click a project card → drills into that project's queue with only its tasks.
4. Click back arrow → returns to Projects Overview.
5. "New Task" on a project card → LaunchCard opens with project pre-filled.
6. Dismiss all tasks for a project while drilled in → empty state appears.
7. New task arrives via IPC → project card updates live / new card appears.
8. Collab and Codex tabs accessible from overview level.
9. Queue/History sub-tabs scoped to drilled-in project.
10. History tab on overview shows global history.

### Authority

- **auto**: ProjectCard component, ProjectsOverview component, CommandCenter conditional rendering, commandCenterStore state additions — standard UI work with no architectural risk.
- **approval**: None — this feature adds UI components and store state without touching backend, IPC, database, or shared types.
