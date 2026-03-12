import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils/cn'

type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize
  active?: boolean
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'w-6 h-6 rounded-md',
  md: 'w-7 h-7 rounded-lg',
  lg: 'w-8 h-8 rounded-lg',
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'sm', active, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'flex items-center justify-center transition-all duration-150 ease-out',
          'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
          sizeClasses[size],
          active
            ? 'bg-accent-blue/15 text-accent-blue'
            : 'hover:bg-white/[0.06] text-white/30 hover:text-white/60',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
export default IconButton
