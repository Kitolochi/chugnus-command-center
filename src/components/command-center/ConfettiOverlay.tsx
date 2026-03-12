import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 60
const DURATION = 2500

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
}

const COLOR_MAP: Record<string, string[]> = {
  blue: ['#3b82f6', '#60a5fa', '#93c5fd'],
  purple: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
  red: ['#ef4444', '#f87171', '#fca5a5'],
  cyan: ['#06b6d4', '#22d3ee', '#67e8f9'],
  green: ['#22c55e', '#4ade80', '#86efac'],
  orange: ['#f97316', '#fb923c', '#fdba74'],
  amber: ['#f59e0b', '#fbbf24', '#fcd34d'],
  pink: ['#ec4899', '#f472b6', '#f9a8d4'],
}

export default function ConfettiOverlay({ color, onDone }: { color: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const colors = COLOR_MAP[color] || COLOR_MAP.blue
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 100,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 8 - 2,
      size: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    }))

    const start = Date.now()
    let raf: number

    const animate = () => {
      const elapsed = Date.now() - start
      if (elapsed > DURATION) { onDone(); return }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const alpha = 1 - elapsed / DURATION

      for (const p of particles) {
        p.x += p.vx
        p.vy += 0.15 // gravity
        p.y += p.vy
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }

      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [color, onDone])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-50 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
