import { BrowserWindow } from 'electron'
import { registerAIHandlers } from './ai'
import { registerMemoryHandlers } from './memory'
import { registerSystemHandlers } from './system'
import { registerKnowledgePackHandlers } from './knowledge-pack'
import { registerSocialHandlers } from './social'
import { registerAgentHandlers } from './agents'
import { registerAgentsViewHandlers } from './agentsview'
import { registerCommandCenterHandlers } from './command-center'
import { registerDualAgentHandlers } from './dual-agent'
import { registerVoiceHandlers } from './voice'

export function registerAllHandlers(mainWindow: BrowserWindow) {
  registerAIHandlers(mainWindow)
  registerMemoryHandlers(mainWindow)
  registerSystemHandlers(mainWindow)
  registerKnowledgePackHandlers(mainWindow)
  registerSocialHandlers(mainWindow)
  registerAgentHandlers(mainWindow)
  registerAgentsViewHandlers()
  registerCommandCenterHandlers(mainWindow)
  registerDualAgentHandlers(mainWindow)
  registerVoiceHandlers(mainWindow)
}
