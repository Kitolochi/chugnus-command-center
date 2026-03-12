import { useEffect } from 'react'
import { useAppStore, TAB_GROUPS } from '../../store'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import TitleBar from './TitleBar'
import TabNavigation from './TabNavigation'
import ContentArea from './ContentArea'
import CommandPalette from '../CommandPalette'
import LaunchCard from '../command-center/LaunchCard'

export default function AppShell() {
  const { activeTab, setExpandedGroup } = useAppStore()
  const launchOpen = useCommandCenterStore(s => s.launchOpen)

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
      {launchOpen && <LaunchCard />}
    </div>
  )
}
