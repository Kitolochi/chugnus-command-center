import { useState } from 'react'

export function useSessionCollapse(id: string, section: string) {
  const key = `cc-collapse:${id}:${section}`
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(key) === 'true' } catch { return false }
  })
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(key, String(next)) } catch { /* Still works if storage is unavailable. */ }
  }
  return [collapsed, toggle] as const
}
