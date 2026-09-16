import { useAppStore } from '../../store'
import ErrorBoundary from '../ui/ErrorBoundary'
import MemoryTab from '../MemoryTab'
import MemoriesTab from '../MemoriesTab'
import LabTab from '../LabTab'
import AgentsTab from '../agents/AgentsTab'
import SessionsTab from '../sessions/SessionsTab'
import CommandCenter from '../command-center/CommandCenter'
import Settings from '../Settings'

export default function ContentArea() {
  const { activeTab } = useAppStore()

  const renderTab = () => {
    if (activeTab === 'command-center') return <CommandCenter />
    if (activeTab === 'agents') return <AgentsTab />
    if (activeTab === 'memories') return <MemoriesTab />
    if (activeTab === 'sessions') return <SessionsTab />
    if (activeTab === 'memory') return <MemoryTab />
    if (activeTab === 'lab') return <LabTab />
    if (activeTab === 'settings') return <Settings />
    return <CommandCenter />
  }

  return (
    <div className="flex-1 min-h-0 relative z-10 bg-surface-0/50 backdrop-blur-sm">
      <ErrorBoundary key={activeTab}>
        <div key={activeTab} className="tab-content-enter h-full overflow-auto">
          {renderTab()}
        </div>
      </ErrorBoundary>
    </div>
  )
}
