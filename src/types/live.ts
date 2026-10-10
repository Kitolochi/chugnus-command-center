export interface LiveMessage {
  role: 'user' | 'assistant' | 'tool'
  text: string
  timestamp?: string
}

/** A Claude Code session running in a terminal, read from ~/.claude/sessions/<pid>.json */
export interface LiveSession {
  pid: number
  sessionId: string
  name: string
  title: string
  cwd: string
  projectName: string
  status: string
  kind: string
  startedAt: number
  updatedAt: number
  lastPrompt?: string
  latestActivity?: string
  doing?: string
}
