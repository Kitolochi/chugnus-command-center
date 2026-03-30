# Project Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat Command Center queue with a two-level project navigation: project cards landing → project-scoped drill-in queue.

**Architecture:** UI-only feature — no backend, IPC, or database changes. Add `selectedProject` + `launchPrefilledProject` to the Zustand store, create `ProjectCard` + `ProjectsOverview` components, modify `CommandCenter.tsx` for conditional rendering, wire `LaunchCard` pre-fill and `HistoryView` auto-filter.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand

**Spec:** `docs/superpowers/specs/2026-03-21-project-groups-design.md`

---

### Task 1: Add Store State

**Files:**
- Modify: `src/store/commandCenterStore.ts`

- [ ] **Step 1: Add state fields and actions to the interface**

In `src/store/commandCenterStore.ts`, add to the `CommandCenterState` interface after `focusId: string | null` (line 62):

```typescript
  selectedProject: string | null
  launchPrefilledProject: string | null

  selectProject: (path: string) => void
  deselectProject: () => void
  setLaunchPrefilledProject: (path: string | null) => void
```

- [ ] **Step 2: Add initial values and action implementations**

In the `create<CommandCenterState>` body, add initial values after `focusId: null,` (line 111):

```typescript
  selectedProject: null,
  launchPrefilledProject: null,
```

Add action implementations after the `updateQueue` line (line 165):

```typescript
  selectProject: (path) => set({ selectedProject: path, focusId: null }),
  deselectProject: () => set({ selectedProject: null, focusId: null }),
  setLaunchPrefilledProject: (path) => set({ launchPrefilledProject: path }),
```

- [ ] **Step 3: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/chris/chugnus-command-center" && git add src/store/commandCenterStore.ts && git commit -m "feat(groups): add selectedProject and launchPrefilledProject to store"
```

---

### Task 2: Create ProjectCard Component

**Files:**
- Create: `src/components/command-center/ProjectCard.tsx`

- [ ] **Step 1: Create ProjectCard.tsx**

The `projectColor` field on `CCQueueItem` contains values like `blue`, `purple`, `red`, `cyan`, `green`, `orange`, `amber`, `pink`. Tailwind config defines accent colors as hex values (e.g., `accent.blue: '#6C8EEF'`). The existing codebase (FocusCard.tsx:273-275) maps these to Badge variants. For the border-left color, use a hex map matching `tailwind.config.cjs` exactly:

Create `src/components/command-center/ProjectCard.tsx`:

```tsx
import { Plus } from 'lucide-react'
import { useCommandCenterStore } from '../../store/commandCenterStore'

export interface ProjectSummary {
  path: string
  name: string
  color: string
  workingCount: number
  awaitingCount: number
  erroredCount: number
  lastPrompt: string
  lastActivity: number
}

const accentHex: Record<string, string> = {
  blue: '#6C8EEF',
  purple: '#A78BFA',
  red: '#F87171',
  emerald: '#34D399',
  green: '#34D399',
  amber: '#FBBF24',
  orange: '#FB923C',
  teal: '#2DD4BF',
  rose: '#F472B6',
  pink: '#F472B6',
  cyan: '#2DD4BF',
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ProjectCard({ project }: { project: ProjectSummary }) {
  const { selectProject, setLaunchPrefilledProject, setLaunchOpen } = useCommandCenterStore()

  const handleLaunch = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLaunchPrefilledProject(project.path)
    setLaunchOpen(true)
  }

  return (
    <div
      onClick={() => selectProject(project.path)}
      className="bg-surface-2 hover:bg-surface-3 border-l-4 rounded-lg p-4 cursor-pointer transition-colors"
      style={{ borderLeftColor: accentHex[project.color] || accentHex.blue }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/90">{project.name}</span>
        <button
          onClick={handleLaunch}
          className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          title="New task for this project"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        {project.workingCount > 0 && (
          <span className="bg-accent-emerald/15 text-accent-emerald px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {project.workingCount} working
          </span>
        )}
        {project.awaitingCount > 0 && (
          <span className="bg-accent-amber/15 text-accent-amber px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {project.awaitingCount} awaiting
          </span>
        )}
        {project.erroredCount > 0 && (
          <span className="bg-accent-red/15 text-accent-red px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {project.erroredCount} errored
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-white/40 truncate">{project.lastPrompt || 'No prompt'}</p>
      <p className="mt-2 text-[10px] text-white/25 font-mono">{relativeTime(project.lastActivity)}</p>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/chris/chugnus-command-center" && git add src/components/command-center/ProjectCard.tsx && git commit -m "feat(groups): create ProjectCard component"
```

---

### Task 3: Create ProjectsOverview Component

**Files:**
- Create: `src/components/command-center/ProjectsOverview.tsx`

- [ ] **Step 1: Create ProjectsOverview.tsx**

Create `src/components/command-center/ProjectsOverview.tsx`:

```tsx
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { EmptyState } from '../ui'
import { Layers } from 'lucide-react'
import ProjectCard from './ProjectCard'
import type { ProjectSummary } from './ProjectCard'
import type { CCQueueItem } from '../../store/commandCenterStore'

function deriveProjects(queue: CCQueueItem[]): ProjectSummary[] {
  const groups = new Map<string, CCQueueItem[]>()
  for (const item of queue) {
    const existing = groups.get(item.projectPath) || []
    existing.push(item)
    groups.set(item.projectPath, existing)
  }

  const summaries: ProjectSummary[] = []
  for (const [path, items] of groups) {
    const latest = items.reduce((a, b) => a.lastActivityAt > b.lastActivityAt ? a : b)
    summaries.push({
      path,
      name: items[0].projectName,
      color: items[0].projectColor,
      workingCount: items.filter(i => i.status === 'working').length,
      awaitingCount: items.filter(i => i.status === 'awaiting_input').length,
      erroredCount: items.filter(i => i.status === 'errored').length,
      lastPrompt: latest.prompt,
      lastActivity: latest.lastActivityAt,
    })
  }

  // Sort: projects needing attention first (awaiting or errored), then by last activity
  summaries.sort((a, b) => {
    const aNeedsAttention = a.awaitingCount + a.erroredCount
    const bNeedsAttention = b.awaitingCount + b.erroredCount
    if (aNeedsAttention > 0 && bNeedsAttention === 0) return -1
    if (bNeedsAttention > 0 && aNeedsAttention === 0) return 1
    return b.lastActivity - a.lastActivity
  })

  return summaries
}

export default function ProjectsOverview() {
  const { queue, setLaunchOpen } = useCommandCenterStore()
  const projects = deriveProjects(queue)

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={20} className="text-white/30" />}
        title="No active projects"
        description="Launch a task to get started."
        action={{ label: 'New Task', onClick: () => setLaunchOpen(true) }}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {projects.map(p => (
        <ProjectCard key={p.path} project={p} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/chris/chugnus-command-center" && git add src/components/command-center/ProjectsOverview.tsx && git commit -m "feat(groups): create ProjectsOverview with project card grid"
```

---

### Task 4: Modify CommandCenter.tsx for Two-Level Navigation

**Files:**
- Modify: `src/components/command-center/CommandCenter.tsx`

This is the core integration task. The existing `CommandCenter.tsx` (222 lines) needs imports, store fields, project-scoped filtering, conditional header, and conditional content rendering.

- [ ] **Step 1: Add imports and read new store fields**

Add import after the coach import (line 11):

```typescript
import ProjectsOverview from './ProjectsOverview'
```

Add `ArrowLeft` to the lucide-react import (line 4):

```typescript
import { ArrowLeft, Layers, Plus, RotateCcw } from 'lucide-react'
```

Expand the store destructure (lines 13-18) to include new fields:

```typescript
const {
  queue, history, activeView, focusId,
  selectedProject,
  loadQueue, loadHistory, loadProjects, launch,
  setActiveView, setLaunchOpen, setFocusId,
  deselectProject, setLaunchPrefilledProject,
} = useCommandCenterStore()
```

- [ ] **Step 2: Add project-scoped filtering and fix sorted derivation**

After the existing count computations (after line 70 `const errorCount = ...`), add project filtering:

```typescript
// Project-scoped filtering
const projectQueue = selectedProject
  ? queue.filter(q => q.projectPath === selectedProject)
  : queue

const projectAwaitingCount = selectedProject
  ? projectQueue.filter(q => q.status === 'awaiting_input').length
  : awaitingCount
const projectWorkingCount = selectedProject
  ? projectQueue.filter(q => q.status === 'working').length
  : workingCount
const projectErrorCount = selectedProject
  ? projectQueue.filter(q => q.status === 'errored').length
  : errorCount
```

Change the existing sort (line 72) to use `projectQueue`:

```typescript
// Sort: awaiting_input first (FIFO), then errored, then working
const sorted = [...projectQueue].sort((a, b) => {
```

The existing focus logic on lines 81-84 already derives from `sorted`, so switching `sorted` to use `projectQueue` makes `focusItem` and `collapsed` project-scoped automatically. `selectProject()` clears `focusId`, so `focusItem` falls through to `sorted[0]` (the top priority task in the filtered project).

Derive the project name for the back button header:

```typescript
const selectedProjectName = selectedProject
  ? (projectQueue[0]?.projectName || 'Project')
  : null
```

Pre-compute project-scoped crashed sessions (avoids repeated `.filter()` in JSX):

```typescript
const projectCrashedSessions = selectedProject
  ? crashedSessions.filter(s => s.projectPath === selectedProject)
  : crashedSessions
```

- [ ] **Step 3: Conditional header — back button vs title**

Replace the left side of the header (lines 98-120). The `<div className="flex items-center gap-3">` block becomes:

```tsx
<div className="flex items-center gap-3">
  {selectedProject ? (
    <>
      <button
        onClick={deselectProject}
        className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white/90 transition-colors"
      >
        <ArrowLeft size={14} className="text-white/40" />
        <span className="font-semibold font-accent tracking-tight">{selectedProjectName}</span>
      </button>
      {projectQueue.length > 0 && (
        <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-[10px] text-white/60 font-medium font-mono">{projectQueue.length} active</span>
        </div>
      )}
    </>
  ) : (
    <>
      <h1 className="text-sm font-semibold text-white/90 font-accent tracking-tight">Command Center</h1>
      {queue.length > 0 && (
        <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-[10px] text-white/60 font-medium font-mono">{queue.length} active</span>
        </div>
      )}
    </>
  )}
  <div className="flex items-center gap-2 text-[10px] font-mono">
    {projectAwaitingCount > 0 && (
      <span className="text-accent-amber">{projectAwaitingCount} awaiting</span>
    )}
    {projectWorkingCount > 0 && (
      <span className="text-accent-emerald">{projectWorkingCount} working</span>
    )}
    {projectErrorCount > 0 && (
      <span className="text-accent-red">{projectErrorCount} errored</span>
    )}
  </div>
  {!selectedProject && (
    <div className="bg-surface-2 rounded-full px-2.5 py-0.5">
      <span className="text-[10px] text-white/40 font-mono">{dailyPrompts} today</span>
    </div>
  )}
</div>
```

- [ ] **Step 4: Wire "New Task" button with project pre-fill**

Replace the existing "New Task" Button (line 165-167):

```tsx
<Button variant="primary" size="sm" onClick={() => {
  if (selectedProject) setLaunchPrefilledProject(selectedProject)
  setLaunchOpen(true)
}}>
  <Plus size={12} /> New Task
</Button>
```

- [ ] **Step 5: Conditional content — ProjectsOverview vs filtered queue**

Replace the `activeView === 'queue'` branch in the content area (lines 176-212) with:

```tsx
) : activeView === 'queue' ? (
  selectedProject ? (
    <>
      {projectCrashedSessions.length > 0 && (
        <div className="flex items-center justify-between bg-accent-amber/5 border border-accent-amber/15 rounded-lg px-4 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <RotateCcw size={12} className="text-accent-amber" />
            <span className="text-[11px] text-white/70">
              {projectCrashedSessions.length} interrupted session{projectCrashedSessions.length > 1 ? 's' : ''}
            </span>
          </div>
          <button onClick={() => setRestoreDismissed(true)} className="text-[10px] text-white/30 hover:text-white/50 transition-colors">
            Dismiss
          </button>
        </div>
      )}
      {projectQueue.length === 0 ? (
        <EmptyState
          icon={<Layers size={20} className="text-white/30" />}
          title="All tasks complete"
          description="This project has no active tasks."
          action={{ label: 'Back to Projects', onClick: deselectProject }}
        />
      ) : (
        <div className="space-y-2">
          {focusItem && <FocusCard item={focusItem} />}
          {collapsed.map(item => (
            <CollapsedCard key={item.processId} item={item} onFocus={() => { setFocusId(item.processId); setUserPinned(true) }} />
          ))}
        </div>
      )}
    </>
  ) : (
    <>
      {crashedSessions.length > 0 && (
        <div className="flex items-center justify-between bg-accent-amber/5 border border-accent-amber/15 rounded-lg px-4 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <RotateCcw size={12} className="text-accent-amber" />
            <span className="text-[11px] text-white/70">
              {crashedSessions.length} session{crashedSessions.length > 1 ? 's were' : ' was'} interrupted
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRestoreDismissed(true)} className="text-[10px] text-white/30 hover:text-white/50 transition-colors">
              Dismiss
            </button>
            <button onClick={handleRestoreAll} className="px-3 py-1 rounded-md bg-accent-amber/15 text-accent-amber text-[10px] font-accent hover:bg-accent-amber/25 transition-all">
              Restore all
            </button>
          </div>
        </div>
      )}
      <ProjectsOverview />
    </>
  )
```

- [ ] **Step 6: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/chris/chugnus-command-center" && git add src/components/command-center/CommandCenter.tsx && git commit -m "feat(groups): two-level project navigation in CommandCenter"
```

---

### Task 5: Wire LaunchCard Pre-Fill

**Files:**
- Modify: `src/components/command-center/LaunchCard.tsx`

- [ ] **Step 1: Read launchPrefilledProject and initialize projectPath**

In `LaunchCard.tsx` (line 7), add `launchPrefilledProject` and `setLaunchPrefilledProject` to the store destructure:

```typescript
const { projects, launch, setLaunchOpen, loadProjects, launchPrefilledProject, setLaunchPrefilledProject } = useCommandCenterStore()
```

Change the `projectPath` state initialization (line 8) to read the pre-fill:

```typescript
const [projectPath, setProjectPath] = useState(launchPrefilledProject || '')
```

- [ ] **Step 2: Add handleClose and useEffect cleanup**

Add a `handleClose` function after the existing `inferModel` callback (after line 41):

```typescript
const handleClose = () => {
  setLaunchPrefilledProject(null)
  setLaunchOpen(false)
}
```

Replace all three `() => setLaunchOpen(false)` calls with `handleClose`:
- Line 61: `<Dialog open onClose={handleClose}>`
- Line 67-70: X button `onClick={handleClose}`
- Line 160: Cancel button `onClick={handleClose}`

Add a `useEffect` cleanup to handle the launch-success path (where `launch()` sets `launchOpen: false` directly in the store, causing LaunchCard to unmount without going through `handleClose`):

```typescript
useEffect(() => {
  return () => { setLaunchPrefilledProject(null) }
}, [setLaunchPrefilledProject])
```

Place this after the existing `useEffect(() => { loadProjects() }, [])` on line 15.

- [ ] **Step 3: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/chris/chugnus-command-center" && git add src/components/command-center/LaunchCard.tsx && git commit -m "feat(groups): pre-fill LaunchCard project from store"
```

---

### Task 6: Wire HistoryView Auto-Filter

**Files:**
- Modify: `src/components/command-center/HistoryView.tsx`

- [ ] **Step 1: Read selectedProject from store**

Find the `useCommandCenterStore()` call in HistoryView and add `selectedProject`:

```typescript
const { history, historyFilter, setHistoryFilter, projects, ..., selectedProject } = useCommandCenterStore()
```

(Keep all existing destructured fields, just add `selectedProject`.)

- [ ] **Step 2: Add useEffect to sync filter**

Add a `useEffect` that sets the history filter when a project is selected:

```typescript
useEffect(() => {
  if (selectedProject && historyFilter !== selectedProject) {
    setHistoryFilter(selectedProject)
  }
}, [selectedProject])
```

Place this after the existing useEffect calls in the component.

- [ ] **Step 3: Hide project filter dropdown when drilled in**

Wrap the project filter `<select>` (lines 209-220) in a conditional:

```tsx
{!selectedProject && (
  <select
    value={historyFilter || ''}
    onChange={e => setHistoryFilter(e.target.value || null)}
    className="bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[10px] text-white/70 focus:outline-none"
  >
    <option value="">All Projects</option>
    {projects.map(p => (
      <option key={p.path} value={p.path}>
        {p.name}
      </option>
    ))}
  </select>
)}
```

- [ ] **Step 4: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/chris/chugnus-command-center" && git add src/components/command-center/HistoryView.tsx && git commit -m "feat(groups): auto-filter HistoryView when project selected"
```

---

### Task 7: Typecheck + Push

**Files:** None (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Push all commits**

```bash
cd "C:/Users/chris/chugnus-command-center" && git push origin feat/usage-coach-agent
```
