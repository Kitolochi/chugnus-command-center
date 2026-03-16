import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import AppShell from './components/layout/AppShell'
import KeyboardCheatsheet from './components/ui/KeyboardCheatsheet'
import VoiceIndicator from './components/ui/VoiceIndicator'

function App() {
  useKeyboardShortcuts()

  return (
    <div className="h-screen bg-surface-0 text-white flex flex-col font-body noise-bg relative isolate">
      <AppShell />
      <KeyboardCheatsheet />
      <VoiceIndicator />
    </div>
  )
}

export default App
