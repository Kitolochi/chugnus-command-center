import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm text-white/70 font-medium mb-1">{title}</p>
      {description && (
        <p className="text-[11px] text-muted mb-4 max-w-[240px]">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 rounded-lg text-xs text-accent-blue font-medium transition-all duration-150"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
