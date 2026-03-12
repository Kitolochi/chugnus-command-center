import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'xs' | 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent-blue hover:bg-accent-blue/80 text-white shadow-sm shadow-accent-blue/10',
  secondary: 'bg-surface-3 hover:bg-surface-4 text-white/80',
  ghost: 'bg-transparent hover:bg-white/[0.06] text-white/60 hover:text-white/80',
  danger: 'bg-accent-red/20 hover:bg-accent-red/30 text-accent-red',
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-[10px] rounded-md',
  sm: 'px-2.5 py-1.5 text-[11px] rounded-lg',
  md: 'px-3.5 py-2 text-xs rounded-lg',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'sm', loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'font-medium transition-all duration-150 ease-out inline-flex items-center justify-center gap-1.5',
          'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && (
          <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
