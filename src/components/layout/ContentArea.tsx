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
    <div className="flex-1 relative z-10 bg-surface-0/50 backdrop-blur-sm overflow-auto">
      <ErrorBoundary key={activeTab}>
        <div key={activeTab} className="tab-content-enter">
          {renderTab()}
        </div>
      </ErrorBoundary>
    </div>
  )
}
