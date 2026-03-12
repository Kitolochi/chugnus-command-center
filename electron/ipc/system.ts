import { ipcMain, BrowserWindow, Notification, clipboard, shell, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { getPomodoroState, startPomodoro, completePomodoro, startBreak, stopPomodoro, savePomodoroSession, getPomodoroStats, getMorningBriefing, saveMorningBriefing, dismissMorningBriefing, getBriefingData, getWeeklyReview, saveWeeklyReview, getAllWeeklyReviews, getWeeklyReviewData, checkWeeklyReviewNeeded, getCategories, getAITasks, createAITask, updateAITask, deleteAITask, moveAITask, getRoadmapGoals, createRoadmapGoal, updateRoadmapGoal, deleteRoadmapGoal, isWelcomeDismissed, dismissWelcome, systemWipe } from '../database'
import { generateMorningBriefing, generateWeeklyReview } from '../summarize'
import { createTerminal, writeTerminal, resizeTerminal, killTerminal } from '../terminal'
import { getCliSessions, getCliSessionMessages, searchCliSessions } from '../cli-logs'
import { searchGitHubRepos } from '../github'
import { transcribeAudio, transcribeAudioBlob, getWhisperStatus } from '../whisper'
import { getEmbeddingStatus } from '../embeddings'
import { rebuildIndex, deleteIndex } from '../vector-store'
import { generateReorgPlan, executeReorgPlan } from '../reorganize'
import { isLLMConfigured } from '../llm'

// --- Helper functions ---

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.py', '.sh', '.bat', '.ps1', '.log', '.env', '.cfg', '.ini', '.conf'])

function getMemoryDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(homeDir, '.claude', 'memory')
}

function scanDirectory(dir: string, memoryRoot: string): any[] {
  const results: any[] = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(memoryRoot, dir).replace(/\\/g, '/')
    const folder = relativePath === '.' ? '' : relativePath
    const stat = fs.statSync(fullPath)
    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        path: fullPath,
        content: '',
        modifiedAt: stat.mtime.toISOString(),
        folder,
        isDirectory: true,
        size: 0
      })
      results.push(...scanDirectory(fullPath, memoryRoot))
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      const isText = TEXT_EXTENSIONS.has(ext)
      let content = ''
      if (isText) {
        try { content = fs.readFileSync(fullPath, 'utf-8') } catch { content = '' }
      }
      results.push({
        name: entry.name,
        path: fullPath,
        content,
        modifiedAt: stat.mtime.toISOString(),
        folder,
        isDirectory: false,
        size: stat.size
      })
    }
  }
  return results
}

function buildLocalBriefing(data: ReturnType<typeof getBriefingData>): string {
  const lines: string[] = []
  if (data.overdueTasks.length > 0) {
    lines.push(`You have ${data.overdueTasks.length} overdue task${data.overdueTasks.length > 1 ? 's' : ''} that need attention.`)
  }
  if (data.todayTasks.length > 0) {
    lines.push(`${data.todayTasks.length} task${data.todayTasks.length > 1 ? 's' : ''} due today.`)
  }
  if (data.highPriorityTasks.length > 0) {
    lines.push(`${data.highPriorityTasks.length} high priority task${data.highPriorityTasks.length > 1 ? 's' : ''}: ${data.highPriorityTasks.slice(0, 3).map(t => t.title).join(', ')}`)
  }
  if (data.streak > 0) {
    lines.push(`You're on a ${data.streak}-day streak! Keep it going.`)
  }
  if (data.stats.tasksCompletedThisWeek > 0) {
    lines.push(`${data.stats.tasksCompletedThisWeek} tasks completed this week so far.`)
  }
  if (lines.length === 0) {
    lines.push('No pressing items today. A great day to get ahead!')
  }
  return lines.map(l => `- ${l}`).join('\n')
}

function buildLocalWeeklyReview(data: ReturnType<typeof getWeeklyReviewData>): string {
  const lines: string[] = []
  lines.push(`**Week Summary**`)
  lines.push(`- Completed ${data.completedTasks.length} task${data.completedTasks.length !== 1 ? 's' : ''}`)
  if (data.focusMinutes > 0) {
    lines.push(`- ${data.focusMinutes} minutes of focused work`)
  }
  if (data.notesWritten.length > 0) {
    lines.push(`- Wrote ${data.notesWritten.length} journal entr${data.notesWritten.length !== 1 ? 'ies' : 'y'}`)
  }
  if (data.categoriesWorked.length > 0) {
    lines.push(`- Active in: ${data.categoriesWorked.join(', ')}`)
  }
  if (data.streak > 0) {
    lines.push(`- Current streak: ${data.streak} days`)
  }
  return lines.join('\n')
}

function scaffoldDomainFolders(): void {
  try {
    const memoryDir = getMemoryDir()
    const domainsDir = path.join(memoryDir, 'domains')

    const domains: Record<string, { label: string; profilePrompts: string[] }> = {
      career: {
        label: 'Career & Professional',
        profilePrompts: [
          'What is your current role/title and company?',
          'What industry do you work in?',
          'What are your key professional skills?',
          'What is your career stage (early, mid, senior, executive)?',
          'What does career success look like to you?',
        ],
      },
      health: {
        label: 'Health & Fitness',
        profilePrompts: [
          'What is your current fitness level (beginner, intermediate, advanced)?',
          'Do you have any health conditions or injuries to work around?',
          'What types of exercise do you enjoy?',
          'What are your dietary preferences or restrictions?',
          'How many hours of sleep do you typically get?',
        ],
      },
      financial: {
        label: 'Financial',
        profilePrompts: [
          'What is your current financial situation (stable, building, recovering)?',
          'Do you have a monthly budget or savings target?',
          'What are your biggest financial obligations?',
          'What is your risk tolerance for investments (conservative, moderate, aggressive)?',
          'Do you have an emergency fund?',
        ],
      },
      relationships: {
        label: 'Relationships & Social',
        profilePrompts: [
          'Who are the most important people in your life?',
          'What relationship areas need the most attention?',
          'How do you prefer to stay connected (calls, texts, in-person)?',
          'Are there relationships you want to strengthen or repair?',
          'How large is your social circle?',
        ],
      },
      learning: {
        label: 'Learning & Education',
        profilePrompts: [
          'What subjects or skills are you currently learning?',
          'What is your preferred learning style (reading, video, hands-on)?',
          'How much time per week can you dedicate to learning?',
          'Do you have any formal education goals (degrees, certifications)?',
          'What topics have you always wanted to explore?',
        ],
      },
      projects: {
        label: 'Projects & Building',
        profilePrompts: [
          'What active projects are you working on?',
          'What tools and technologies do you use most?',
          'Do you work solo or with a team?',
          'What is your project management style?',
          'What is the biggest project you have completed?',
        ],
      },
      personal: {
        label: 'Personal Development',
        profilePrompts: [
          'What personal habits are you trying to build or break?',
          'What are your core values?',
          'What does a great day look like for you?',
          'What areas of personal growth matter most right now?',
          'How do you handle stress and recharge?',
        ],
      },
      creative: {
        label: 'Creative & Hobbies',
        profilePrompts: [
          'What creative outlets do you enjoy (writing, music, art, etc.)?',
          'How much time do you spend on hobbies per week?',
          'Are there creative skills you want to develop?',
          'Do you share your creative work publicly?',
          'What inspires you creatively?',
        ],
      },
    }

    let created = 0
    let existed = 0

    for (const [slug, domain] of Object.entries(domains)) {
      const domainDir = path.join(domainsDir, slug)
      if (!fs.existsSync(domainDir)) fs.mkdirSync(domainDir, { recursive: true })

      const files: Record<string, string> = {
        'index.md': `# ${domain.label}\n\nThis folder contains structured context for your ${domain.label.toLowerCase()} goals.\nFiles here are automatically included when generating master plans.\n\n## Files\n- **profile.md** — Who you are in this domain\n- **goals.md** — What you want to achieve\n- **current_state.md** — Where you are right now\n- **history.md** — Key events, milestones, and decisions\n`,
        'profile.md': `# ${domain.label} — Profile\n\nFill in what is relevant. Delete questions that do not apply.\n\n${domain.profilePrompts.map(p => `## ${p}\n\n(your answer here)\n`).join('\n')}\n---\n*Last updated: (auto-filled on edit)*\n`,
        'goals.md': `# ${domain.label} — Goals\n\nList your current goals in this area. Be specific about outcomes and timelines.\n\n## Active Goals\n\n- \n\n## Completed Goals\n\n- \n\n## Someday / Maybe\n\n- \n`,
        'current_state.md': `# ${domain.label} — Current State\n\nCapture a snapshot of where you are right now. Update this periodically.\n\n## Status\n\n(describe your current situation)\n\n## Recent Progress\n\n- \n\n## Blockers or Challenges\n\n- \n\n## Next Actions\n\n- \n`,
        'history.md': `# ${domain.label} — History\n\nRecord key milestones, decisions, and turning points.\n\n## Timeline\n\n- **${new Date().toISOString().split('T')[0]}** — Domain folder created\n`,
      }

      for (const [fileName, content] of Object.entries(files)) {
        const filePath = path.join(domainDir, fileName)
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, content, 'utf-8')
          created++
        } else {
          existed++
        }
      }
    }

    console.log(`Domain folders scaffolded: ${created} files created, ${existed} already existed`)
  } catch (err) {
    console.error('Failed to scaffold domain folders:', err)
  }
}

// Export scaffoldDomainFolders for use in main.ts startup
export { scaffoldDomainFolders }

export function registerSystemHandlers(mainWindow: BrowserWindow) {
  // Terminal
  ipcMain.handle('create-terminal', (_, cols: number, rows: number) => {
    if (mainWindow) createTerminal(mainWindow, cols, rows)
  })

  ipcMain.handle('write-terminal', (_, data: string) => {
    writeTerminal(data)
  })

  ipcMain.handle('resize-terminal', (_, cols: number, rows: number) => {
    resizeTerminal(cols, rows)
  })

  ipcMain.handle('kill-terminal', () => {
    killTerminal()
  })

  // Clipboard
  ipcMain.on('read-clipboard', (event) => {
    event.returnValue = clipboard.readText()
  })

  ipcMain.on('write-clipboard', (_, text: string) => {
    clipboard.writeText(text)
  })

  // Open URL in browser
  ipcMain.handle('open-external', (_, url: string) => {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        console.warn('Blocked shell.openExternal with protocol:', parsed.protocol)
        return false
      }
      return shell.openExternal(url)
    } catch {
      console.warn('Invalid URL passed to shell.openExternal:', url)
      return false
    }
  })

  // Window controls
  ipcMain.on('close-window', () => {
    mainWindow?.hide()
  })

  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize()
  })

  // Notifications
  ipcMain.handle('show-notification', (_, title: string, body: string) => {
    new Notification({ title, body }).show()
  })

  // Context Files
  ipcMain.handle('get-context-files', () => {
    const memoryDir = getMemoryDir()
    try {
      if (!fs.existsSync(memoryDir)) return []
      return scanDirectory(memoryDir, memoryDir)
    } catch {
      return []
    }
  })

  ipcMain.handle('save-context-file', (_, name: string, content: string, folder: string = '') => {
    const memoryDir = getMemoryDir()
    try {
      const targetDir = folder ? path.join(memoryDir, folder) : memoryDir
      const filePath = path.join(targetDir, name)
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(path.resolve(memoryDir))) {
        throw new Error('Path traversal detected')
      }
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
      fs.writeFileSync(filePath, content, 'utf-8')
      const stat = fs.statSync(filePath)
      return { name, path: filePath, content, modifiedAt: stat.mtime.toISOString(), folder, isDirectory: false, size: stat.size }
    } catch (err: any) {
      throw new Error('Failed to save context file: ' + (err.message || err))
    }
  })

  ipcMain.handle('delete-context-file', (_, relativePath: string) => {
    const memoryDir = getMemoryDir()
    try {
      const filePath = path.join(memoryDir, relativePath)
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(path.resolve(memoryDir))) return false
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('create-context-folder', (_, relativePath: string) => {
    const memoryDir = getMemoryDir()
    try {
      const folderPath = path.join(memoryDir, relativePath)
      const resolved = path.resolve(folderPath)
      if (!resolved.startsWith(path.resolve(memoryDir))) return false
      fs.mkdirSync(folderPath, { recursive: true })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('delete-context-folder', (_, relativePath: string) => {
    const memoryDir = getMemoryDir()
    try {
      const folderPath = path.join(memoryDir, relativePath)
      const resolved = path.resolve(folderPath)
      if (!resolved.startsWith(path.resolve(memoryDir))) return false
      if (!fs.existsSync(folderPath)) return false
      const contents = fs.readdirSync(folderPath)
      if (contents.length > 0) return false // only delete empty folders
      fs.rmdirSync(folderPath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('upload-context-files', async (_, targetFolder: string) => {
    const memoryDir = getMemoryDir()
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Upload files to context'
    })
    if (result.canceled || result.filePaths.length === 0) return []
    const uploaded: any[] = []
    const destDir = targetFolder ? path.join(memoryDir, targetFolder) : memoryDir
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    for (const srcPath of result.filePaths) {
      const fileName = path.basename(srcPath)
      const destPath = path.join(destDir, fileName)
      fs.copyFileSync(srcPath, destPath)
      const stat = fs.statSync(destPath)
      const ext = path.extname(fileName).toLowerCase()
      const isText = TEXT_EXTENSIONS.has(ext)
      let content = ''
      if (isText) {
        try { content = fs.readFileSync(destPath, 'utf-8') } catch { content = '' }
      }
      uploaded.push({
        name: fileName,
        path: destPath,
        content,
        modifiedAt: stat.mtime.toISOString(),
        folder: targetFolder,
        isDirectory: false,
        size: stat.size
      })
    }
    return uploaded
  })

  // Domain Folders
  ipcMain.handle('scaffold-domain-folders', () => {
    scaffoldDomainFolders()
    return true
  })

  // Whisper
  ipcMain.handle('get-whisper-status', () => {
    return getWhisperStatus()
  })

  ipcMain.handle('transcribe-audio', async (_, audioData: number[]) => {
    const float32 = new Float32Array(audioData)
    return transcribeAudio(float32)
  })

  ipcMain.handle('transcribe-audio-blob', async (_, webmData: number[]) => {
    return transcribeAudioBlob(new Uint8Array(webmData))
  })

  // Embeddings / Vector index
  ipcMain.handle('get-embedding-status', () => {
    return getEmbeddingStatus()
  })

  ipcMain.handle('rebuild-vector-index', async () => {
    return rebuildIndex((info) => {
      mainWindow?.webContents.send('index-progress', info)
    })
  })

  ipcMain.handle('generate-reorg-plan', async () => {
    if (!isLLMConfigured()) throw new Error('No AI provider configured.')
    return generateReorgPlan()
  })

  ipcMain.handle('execute-reorg-plan', async (_, plan: any) => {
    const result = await executeReorgPlan(plan)
    try {
      await deleteIndex()
      const embStatus = getEmbeddingStatus()
      if (embStatus.ready) {
        await rebuildIndex()
      }
    } catch (err) {
      console.error('Re-index after reorg failed:', err)
    }
    return result
  })

  // CLI logs
  ipcMain.handle('get-cli-sessions', async () => {
    return getCliSessions()
  })

  ipcMain.handle('get-cli-session-messages', async (_, sessionId: string, offset?: number, limit?: number) => {
    return getCliSessionMessages(sessionId, offset, limit)
  })

  ipcMain.handle('search-cli-sessions', async (_, query: string) => {
    return searchCliSessions(query)
  })

  ipcMain.handle('search-github-repos', async (_, query: string) => {
    return searchGitHubRepos(query)
  })

  // Welcome modal
  ipcMain.handle('is-welcome-dismissed', () => isWelcomeDismissed())
  ipcMain.handle('dismiss-welcome', () => { dismissWelcome() })

  // Launch external terminal
  ipcMain.handle('launch-external-terminal', async (_, prompt: string, cwd?: string) => {
    const workingDir = cwd || process.env.USERPROFILE || '.'
    const env = { ...process.env }
    delete env.CLAUDECODE
    const tmpDir = path.join(app.getPath('temp'), 'mega-agenda')
    fs.mkdirSync(tmpDir, { recursive: true })
    const batFile = path.join(tmpDir, `launch-${Date.now()}.bat`)
    const safePrompt = prompt.replace(/%/g, '%%').replace(/"/g, "'").replace(/[&|<>^]/g, '^$&')
    fs.writeFileSync(batFile, [
      '@echo off',
      `cd /d "${workingDir}"`,
      `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools "Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" -- "${safePrompt}"`,
    ].join('\r\n'))
    const child = spawn('cmd.exe', ['/c', 'start', '""', 'cmd', '/k', batFile], {
      detached: true,
      stdio: 'ignore',
      env,
    })
    child.unref()
  })

  // Pomodoro
  ipcMain.handle('get-pomodoro-state', () => {
    return getPomodoroState()
  })

  ipcMain.handle('start-pomodoro', (_, taskId: number | null, taskTitle: string, durationMinutes?: number) => {
    return startPomodoro(taskId, taskTitle, durationMinutes)
  })

  ipcMain.handle('complete-pomodoro', () => {
    return completePomodoro()
  })

  ipcMain.handle('start-break', (_, type: 'short_break' | 'long_break') => {
    return startBreak(type)
  })

  ipcMain.handle('stop-pomodoro', () => {
    return stopPomodoro()
  })

  ipcMain.handle('save-pomodoro-session', (_, record: any) => {
    return savePomodoroSession(record)
  })

  ipcMain.handle('get-pomodoro-stats', () => {
    return getPomodoroStats()
  })

  // Morning Briefing
  ipcMain.handle('get-morning-briefing', (_, date: string) => {
    return getMorningBriefing(date)
  })

  ipcMain.handle('generate-morning-briefing', async () => {
    const today = new Date().toISOString().split('T')[0]
    const existing = getMorningBriefing(today)
    if (existing) return existing

    const data = getBriefingData()

    let content: string
    let isAiEnhanced = false

    if (isLLMConfigured()) {
      try {
        content = await generateMorningBriefing(data)
        isAiEnhanced = true
      } catch {
        content = buildLocalBriefing(data)
      }
    } else {
      content = buildLocalBriefing(data)
    }

    const briefing = {
      date: today,
      content,
      isAiEnhanced,
      dismissed: false,
      generatedAt: new Date().toISOString()
    }
    return saveMorningBriefing(briefing)
  })

  ipcMain.handle('dismiss-morning-briefing', (_, date: string) => {
    return dismissMorningBriefing(date)
  })

  // Weekly Review
  ipcMain.handle('get-weekly-review', (_, weekStart: string) => {
    return getWeeklyReview(weekStart)
  })

  ipcMain.handle('get-all-weekly-reviews', () => {
    return getAllWeeklyReviews()
  })

  ipcMain.handle('generate-weekly-review', async (_, weekStart: string) => {
    const existing = getWeeklyReview(weekStart)
    if (existing) return existing

    const data = getWeeklyReviewData(weekStart)
    const categories = getCategories()

    let content: string
    if (isLLMConfigured()) {
      try {
        content = await generateWeeklyReview({
          completedTasks: data.completedTasks.map(t => ({
            title: t.title,
            category: categories.find(c => c.id === t.category_id)?.name || 'Unknown',
            priority: t.priority
          })),
          focusMinutes: data.focusMinutes,
          notesCount: data.notesWritten.length,
          categoriesWorked: data.categoriesWorked,
          streak: data.streak
        })
      } catch {
        content = buildLocalWeeklyReview(data)
      }
    } else {
      content = buildLocalWeeklyReview(data)
    }

    const review = {
      weekStartDate: weekStart,
      content,
      generatedAt: new Date().toISOString(),
      tasksCompletedCount: data.completedTasks.length,
      categoriesWorked: data.categoriesWorked,
      streakAtGeneration: data.streak
    }
    return saveWeeklyReview(review)
  })

  ipcMain.handle('check-weekly-review-needed', () => {
    return checkWeeklyReviewNeeded()
  })

  // Roadmap Goals
  ipcMain.handle('get-roadmap-goals', () => {
    return getRoadmapGoals()
  })

  ipcMain.handle('create-roadmap-goal', (_, goal: any) => {
    return createRoadmapGoal(goal)
  })

  ipcMain.handle('update-roadmap-goal', (_, id: string, updates: any) => {
    return updateRoadmapGoal(id, updates)
  })

  ipcMain.handle('delete-roadmap-goal', (_, id: string) => {
    return deleteRoadmapGoal(id)
  })

  // AI Tasks
  ipcMain.handle('get-ai-tasks', () => {
    return getAITasks()
  })

  ipcMain.handle('create-ai-task', (_, task: { title: string; description: string; priority: 'low' | 'medium' | 'high'; tags: string[] }) => {
    return createAITask(task)
  })

  ipcMain.handle('update-ai-task', (_, id: string, updates: any) => {
    return updateAITask(id, updates)
  })

  ipcMain.handle('delete-ai-task', (_, id: string) => {
    return deleteAITask(id)
  })

  ipcMain.handle('move-ai-task', (_, id: string, column: string) => {
    return moveAITask(id, column as any)
  })

  // System Wipe
  ipcMain.handle('system-wipe', () => {
    systemWipe()
  })
}
