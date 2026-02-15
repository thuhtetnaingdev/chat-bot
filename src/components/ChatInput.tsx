import { useState, type KeyboardEvent, type FormEvent, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Square, ArrowUp } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer'
import { AudioVisualizer } from '@/components/AudioVisualizer'
import { VoiceInputButton } from '@/components/VoiceInputButton'
import { transcribeAudio } from '@/lib/api'

export interface ChatInputProps {
  onSend: (message: string) => Promise<void>
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  apiKey?: string
  isThinking: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, apiKey = '' }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)

  const {
    isRecording,
    audioBlob,
    error: recordingError,
    recordingDuration,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder()

  const { audioData, connectStream, disconnectStream } = useAudioVisualizer()

  const streamRef = useRef<MediaStream | null>(null)
  const processedBlobRef = useRef<string | null>(null)

  // Handle transcription when audioBlob becomes available
  useEffect(() => {
    const processTranscription = async () => {
      if (audioBlob && apiKey && !isTranscribing) {
        // Create unique identifier for this blob
        const blobId = `${audioBlob.size}-${audioBlob.type}-${Date.now()}`
        
        // Skip if already processed
        if (processedBlobRef.current === blobId) {
          return
        }
        
        processedBlobRef.current = blobId
        setIsTranscribing(true)
        setTranscriptionError(null)

        try {
          const transcribedText = await transcribeAudio(audioBlob, apiKey)
          if (transcribedText.trim()) {
            setInput(prev => prev + (prev ? ' ' : '') + transcribedText.trim())
          }
        } catch (err) {
          if (err instanceof Error) {
            setTranscriptionError(err.message)
          }
        } finally {
          setIsTranscribing(false)
          resetRecording()
        }
      }
    }

    processTranscription()
  }, [audioBlob, apiKey, isTranscribing, resetRecording])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isStreaming && !disabled && !isTranscribing) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleStartRecording = async () => {
    try {
      setTranscriptionError(null)
      processedBlobRef.current = null
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      connectStream(stream)
      startRecording()
    } catch (err) {
      console.error('Failed to access microphone:', err)
      if (err instanceof Error) {
        setTranscriptionError(err.message)
      }
    }
  }

  const handleStopRecording = () => {
    stopRecording()
    disconnectStream()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const handleClearError = () => {
    setTranscriptionError(null)
    resetRecording()
    processedBlobRef.current = null
  }

  const isInputDisabled = disabled || isStreaming || isTranscribing || isRecording

  return (
    <div className="border-t border-border/50 bg-card/30">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit}>
          {/* Error Message */}
          {(transcriptionError || recordingError) && (
            <div className="mb-3 flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">
                {transcriptionError || recordingError}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearError}
                className="h-7 text-xs hover:bg-destructive/20"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Main Input Row */}
          <div className="flex items-end gap-2">
            {/* Voice Button */}
            <VoiceInputButton
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              disabled={disabled || isStreaming}
              recordingDuration={recordingDuration}
            />

            {/* Text Input */}
            <div className="flex-1 min-w-0">
              <div className="relative border border-border/50 rounded-lg bg-background focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-colors">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? 'Recording...' : 'Type your message...'}
                  disabled={isInputDisabled}
                  className="min-h-[64px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
                  rows={2}
                />
                {input.length > 0 && (
                  <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60">
                    {input.length}
                  </div>
                )}
              </div>
            </div>

            {/* Send Button */}
            {!isStreaming ? (
              <Button
                type="submit"
                disabled={disabled || !input.trim() || isRecording || isTranscribing}
                className="h-[64px] w-[64px] shrink-0 rounded-lg border border-primary/50 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all p-0"
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onStop}
                variant="destructive"
                disabled={isRecording || isTranscribing}
                className="h-[64px] w-[64px] shrink-0 rounded-lg border border-destructive/50 bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all p-0"
              >
                <Square className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Audio Visualizer */}
          {isRecording && audioData && (
            <div className="mt-3 h-10 rounded-lg bg-muted/30 border border-border/30 overflow-hidden">
              <AudioVisualizer
                audioData={audioData}
                isActive={isRecording}
                barCount={32}
              />
            </div>
          )}

          {/* Helper Text */}
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono">Enter</kbd> to send</span>
              <span className="text-muted-foreground/30">|</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono">Shift + Enter</kbd> for new line</span>
              {isRecording && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="text-destructive font-medium">Recording...</span>
                </>
              )}
              {isTranscribing && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="text-primary font-medium">Transcribing...</span>
                </>
              )}
            </div>
            {disabled && !isRecording && !isTranscribing && (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                <span>API key required</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
