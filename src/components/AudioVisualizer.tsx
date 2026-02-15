import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface AudioVisualizerProps {
  audioData: Uint8Array | null
  isActive: boolean
  barCount?: number
  barColor?: string
  className?: string
}

export function AudioVisualizer({ 
  audioData, 
  isActive, 
  barCount = 32,
  barColor = 'var(--primary)',
  className
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (!isActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (!audioData) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      const barWidth = canvas.width / barCount
      const gap = 2
      const actualBarWidth = barWidth - gap

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * audioData.length / barCount)
        const value = audioData[dataIndex] || 0
        const barHeight = (value / 255) * canvas.height

        const x = i * barWidth + gap / 2
        const y = (canvas.height - barHeight) / 2

        ctx.fillStyle = barColor
        ctx.beginPath()
        ctx.roundRect(x, y, actualBarWidth, barHeight, 2)
        ctx.fill()
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [audioData, isActive, barCount, barColor])

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={40}
      className={cn('w-full h-10', className)}
    />
  )
}
