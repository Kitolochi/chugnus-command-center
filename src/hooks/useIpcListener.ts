import { useEffect } from 'react'

type CleanupFn = () => void

export function useIpcListener<T>(
  subscribe: (callback: (data: T) => void) => CleanupFn,
  handler: (data: T) => void,
  deps: any[] = []
) {
  useEffect(() => {
    const cleanup = subscribe(handler)
    return cleanup
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
