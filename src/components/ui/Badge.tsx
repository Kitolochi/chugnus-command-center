import { cn } from '../../utils/cn'

type BadgeVariant = 'default' | 'blue' | 'purple' | 'emerald' | 'amber' | 'red'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-white/50',
  blue: 'bg-accent-blue/20 text-accent-blue',
  purple: 'bg-accent-purple/20 text-accent-purple',
  emerald: 'bg-accent-emerald/20 text-accent-emerald',
  amber: 'bg-accent-amber/20 text-accent-amber',
  red: 'bg-accent-red/20 text-accent-red',
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  )
}
