/** Label and colors for a terminal session's registry status (busy / idle). */
export function statusLabel(status: string): { text: string; color: string; dot: string } {
  if (status === 'busy')
    return { text: 'Working', color: 'text-accent-emerald', dot: 'bg-accent-emerald animate-pulse' }
  if (status === 'idle') return { text: 'Waiting for you', color: 'text-accent-amber', dot: 'bg-accent-amber' }
  return { text: status, color: 'text-white/40', dot: 'bg-white/30' }
}
