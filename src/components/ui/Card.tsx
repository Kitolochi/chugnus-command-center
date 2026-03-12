import { cn } from '../../utils/cn'

type CardVariant = 'glass' | 'flat' | 'outline'

interface CardProps {
  children: React.ReactNode
  variant?: CardVariant
  className?: string
  onClick?: () => void
}

const variantClasses: Record<CardVariant, string> = {
  glass: 'glass-card',
  flat: 'bg-surface-2',
  outline: 'bg-transparent border border-white/[0.06]',
}

export default function Card({ children, variant = 'glass', className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl transition-all duration-150',
        variantClasses[variant],
        onClick && 'cursor-pointer hover:translate-y-[-1px]',
        className
      )}
    >
      {children}
    </div>
  )
}
