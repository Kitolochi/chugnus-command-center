import type { CodexSession } from '../types/codex'
import type { CCQueueItem } from '../store/commandCenterStore'

export function codexQueueItem(session: CodexSession): CCQueueItem {
  return {
    processId: session.id,
    sessionId: session.threadId,
    projectPath: session.projectPath,
    projectName: session.projectPath.split(/[/\\]/).filter(Boolean).pop() || 'Project',
    provider: 'codex',
    projectColor: 'blue',
    prompt: session.title,
    status: session.status === 'working' ? 'working' : session.status === 'error' ? 'errored' : 'awaiting_input',
    resultText: [...session.messages].reverse().find((m) => m.role === 'assistant')?.content,
    errorMessage: session.error,
    filesChanged: session.filesChanged,
    fullLog: [
      ...session.messages.map((m) => ({ type: m.role, text: m.content, timestamp: session.updatedAt })),
      ...session.activity.map((a) => ({
        type: 'tool_use',
        toolName: a.kind,
        toolInput: a.text,
        timestamp: session.updatedAt,
      })),
    ],
    costUsd: 0,
    turnCount: session.turns,
    startedAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastActivityAt: session.updatedAt,
    model: session.model,
    effort: session.effort,
  }
}
