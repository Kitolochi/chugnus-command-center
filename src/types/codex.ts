import type { ConversationResource } from '../lib/conversationContext'

export type CodexAccess = 'read-only' | 'workspace-write' | 'danger-full-access'

export interface CodexTurnOptions {
  projectPath: string
  prompt: string
  sessionId?: string
  model?: string
  effort?: string
  access: CodexAccess
  windowsSandbox?: 'unelevated'
  attachments?: string[]
}

export interface CodexActivity {
  id: string
  kind: string
  text: string
  status?: string
  updatedAt?: number
}

export interface CodexMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
  state?: 'starting' | 'working' | 'completed' | 'interrupted' | 'failed'
  queuedId?: string
  submittedAt?: number
  startedAt?: number
  finishedAt?: number
}

export interface CodexSession {
  id: string
  threadId?: string
  projectPath: string
  title: string
  model?: string
  effort?: string
  access: CodexAccess
  windowsSandbox?: 'unelevated'
  status: 'working' | 'ready' | 'error' | 'stopped'
  archived: boolean
  disposition?: 'parked' | 'completed' | 'killed'
  imported?: boolean
  pendingTurns?: { id: string; options: CodexTurnOptions }[]
  queuePaused?: boolean
  pauseReason?: 'user' | 'error'
  resumeOnRestart?: boolean
  activeTurn?: CodexTurnOptions
  worker?: { pid: number; parentPid: number; startedAt: number }
  messages: CodexMessage[]
  activeMessageId?: string
  lastEventAt?: number
  activity: CodexActivity[]
  filesChanged: string[]
  resources?: ConversationResource[]
  tokensIn: number
  tokensOut: number
  turns: number
  error?: string
  memoryTitles?: string[]
  memoryError?: string
  createdAt: number
  updatedAt: number
}

export interface CodexStatus {
  available: boolean
  version?: string
  auth?: string
  error?: string
}

export interface CodexHistoryEntry {
  threadId: string
  projectPath: string
  title: string
  updatedAt: number
  filePath: string
  size: number
}

export interface CodexModel {
  model: string
  displayName: string
  description: string
  defaultEffort?: string
  efforts: { value: string; description: string }[]
}

export interface CodexModelSettings {
  models: CodexModel[]
  defaultModel: string
  defaultEffort?: string
}
