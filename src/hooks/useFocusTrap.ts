import { useEffect, useRef, RefObject } from 'react'

export function useFocusTrap(active: boolean): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    if (!active || !ref.current) return

    const element = ref.current
    const focusable = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length > 0) focusable[0].focus()

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const updatedFocusable = element.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const first = updatedFocusable[0]
      const last = updatedFocusable[updatedFocusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    window.addEventListener('keydown', handleTab)
    return () => window.removeEventListener('keydown', handleTab)
  }, [active])

  return ref
}
