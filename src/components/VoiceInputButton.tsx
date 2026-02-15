import { Button } from '@/components/ui/button'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceInputButtonProps {
  isRecording: boolean
  isTranscribing: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  disabled?: boolean
  recordingDuration?: number
}

export function VoiceInputButton({ 
  isRecording, 
  isTranscribing,
  onStartRecording,
  onStopRecording,
  disabled,
  recordingDuration = 0
}: VoiceInputButtonProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative">
      <Button
        type="button"
        size="icon"
        onClick={isRecording ? onStopRecording : onStartRecording}
        disabled={disabled || isTranscribing}
        className={cn(
          'h-[64px] w-[64px] shrink-0 border shadow-xs transition-all rounded-lg',
          isRecording
            ? 'border-destructive/50 bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse'
            : 'border-border/50 bg-card text-foreground hover:bg-accent/50 hover:border-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isTranscribing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {isRecording && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-muted border border-border/50 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
          {formatDuration(recordingDuration)}
        </div>
      )}
    </div>
  )
}
