import { useEffect } from 'react'
import { useAppStore, TAB_GROUPS } from '../../store'
import TitleBar from './TitleBar'
import TabNavigation from './TabNavigation'
import ContentArea from './ContentArea'
import CommandPalette from '../CommandPalette'

export default function AppShell() {
  const { activeTab, setExpandedGroup } = useAppStore()

  // Auto-expand the group containing the active tab
  useEffect(() => {
    const group = TAB_GROUPS.find(g => g.tabs.some(t => t.id === activeTab))
    if (group && group.tabs.length > 1) {
      setExpandedGroup(group.id)
    } else if (group && group.tabs.length === 1) {
      setExpandedGroup(null)
    }
  }, [activeTab, setExpandedGroup])

  return (
    <div className="flex flex-col h-screen relative">
      <TitleBar />
      <TabNavigation />
      <ContentArea />
      <CommandPalette />
    </div>
  )
}
