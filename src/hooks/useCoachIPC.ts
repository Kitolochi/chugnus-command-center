import { useEffect } from 'react'
import { useCoachStore } from '../store'

/** Subscribe to coach IPC events. Mount once in App.tsx so it's always active. */
export function useCoachIPC() {
  const { setTips, setStatus, setSessionCount, setDaySummary } = useCoachStore()

  useEffect(() => {
    const unsubTips = window.electronAPI.onCoachTips((incoming) => setTips(incoming))
    const unsubStatus = window.electronAPI.onCoachStatus((data) => {
      setStatus(data.status as any)
      setSessionCount(data.sessionCount)
    })
    const unsubSummary = window.electronAPI.onCoachDaySummary((summary) => setDaySummary(summary))
    return () => { unsubTips(); unsubStatus(); unsubSummary() }
  }, [setTips, setStatus, setSessionCount, setDaySummary])
}
