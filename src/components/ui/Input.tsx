import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="text-[11px] text-muted font-medium">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-surface-2 border rounded-lg px-3 py-2 text-sm text-white/90',
            'focus:outline-none transition-all duration-150 placeholder-muted/50',
            error
              ? 'border-accent-red/40 focus:border-accent-red/60'
              : 'border-white/[0.06] focus:border-accent-blue/40',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-[10px] text-accent-red">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
