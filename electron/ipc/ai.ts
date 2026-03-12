import { ipcMain, BrowserWindow } from 'electron'
import { getClaudeApiKey, saveClaudeApiKey, getLLMSettings, saveLLMSettings } from '../database'
import { verifyLLMKey, PROVIDER_MODELS, PROVIDER_CHAT_MODELS } from '../llm'
import { streamSmartQuery } from '../smart-query'

/** Agent config for task-type routing */
function getAgentConfig(taskType?: string): { preamble: string; allowedTools: string } {
  switch (taskType) {
    case 'research':
      return {
        preamble: 'You are a research specialist. Focus on gathering information, analyzing sources, and producing well-organized findings. Prioritize depth and accuracy.',
        allowedTools: '"Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" "Write(*)"',
      }
    case 'code':
      return {
        preamble: 'You are a software engineering specialist. Write clean, working code. Follow best practices, add appropriate error handling, and create production-ready implementations.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)"',
      }
    case 'writing':
      return {
        preamble: 'You are a writing specialist. Produce clear, well-structured content. Focus on readability, appropriate tone, and comprehensive coverage of the topic.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'planning':
      return {
        preamble: 'You are a strategic planning specialist. Create detailed, actionable plans with clear milestones, dependencies, and success criteria.',
        allowedTools: '"Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'communication':
      return {
        preamble: 'You are a communication specialist. Draft professional, clear communications. Consider the audience, tone, and key messages.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    default:
      return {
        preamble: 'You are a capable AI assistant. Complete the assigned task thoroughly and produce high-quality deliverables.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
  }
}

// Exported for use in agents.ts
export { getAgentConfig }

export function registerAIHandlers(mainWindow: BrowserWindow) {
  // Claude API
  ipcMain.handle('get-claude-api-key', () => {
    return getClaudeApiKey()
  })

  ipcMain.handle('save-claude-api-key', (_, key: string) => {
    saveClaudeApiKey(key)
    return true
  })

  // LLM Settings
  ipcMain.handle('get-llm-settings', () => {
    return getLLMSettings()
  })

  ipcMain.handle('save-llm-settings', (_, updates: any) => {
    return saveLLMSettings(updates)
  })

  ipcMain.handle('verify-llm-key', async (_, provider: string, key: string) => {
    return verifyLLMKey(provider, key)
  })

  ipcMain.handle('get-provider-models', () => {
    return PROVIDER_MODELS
  })

  ipcMain.handle('get-provider-chat-models', () => {
    return PROVIDER_CHAT_MODELS
  })

  // Smart Query
  ipcMain.handle('smart-query', async (_, query: string) => {
    if (!mainWindow) throw new Error('No main window')
    const queryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    streamSmartQuery(mainWindow, queryId, query)
    return { queryId }
  })
}
