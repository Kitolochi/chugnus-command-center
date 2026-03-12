interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const dotSize = size === 'sm' ? 'w-1 h-1' : size === 'lg' ? 'w-2 h-2' : 'w-1.5 h-1.5'
  const gap = size === 'sm' ? 'gap-1' : size === 'lg' ? 'gap-2' : 'gap-1.5'

  return (
    <div className={`flex items-center justify-center ${gap} ${className}`}>
      <div className={`${dotSize} rounded-full bg-accent-blue/60 animate-pulse-soft`} style={{ animationDelay: '0ms' }} />
      <div className={`${dotSize} rounded-full bg-accent-blue/60 animate-pulse-soft`} style={{ animationDelay: '200ms' }} />
      <div className={`${dotSize} rounded-full bg-accent-blue/60 animate-pulse-soft`} style={{ animationDelay: '400ms' }} />
    </div>
  )
}
