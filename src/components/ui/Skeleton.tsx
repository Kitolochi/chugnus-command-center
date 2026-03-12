import { cn } from '../../utils/cn'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export default function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
  const baseClasses = 'animate-pulse-soft bg-surface-3 rounded'
  const variantClasses = {
    text: 'h-3 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{ width, height }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <Skeleton variant="text" className="w-2/3 h-4" />
      <Skeleton variant="text" className="w-full h-3" />
      <Skeleton variant="text" className="w-4/5 h-3" />
    </div>
  )
}
