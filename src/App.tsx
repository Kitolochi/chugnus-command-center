import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import AppShell from './components/layout/AppShell'
import KeyboardCheatsheet from './components/ui/KeyboardCheatsheet'
import VoiceIndicator from './components/ui/VoiceIndicator'
import ErrorBoundary from './components/ui/ErrorBoundary'

function App() {
  useKeyboardShortcuts()

  return (
    <div className="h-screen bg-surface-0 text-white flex flex-col font-body noise-bg relative isolate">
      <AppShell />
      <KeyboardCheatsheet />
      <ErrorBoundary fallback={null}>
        <VoiceIndicator />
      </ErrorBoundary>
    </div>
  )
}

export default App
