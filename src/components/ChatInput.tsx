import { useState, type KeyboardEvent, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Square, ArrowUp } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isStreaming && !disabled) {
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

  return (
    <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end gap-3">
            <div className="relative flex-1 h-[60px]">
              <div className="absolute inset-0 rounded-lg border border-border/50 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  disabled={disabled || isStreaming}
                  className="h-[60px] min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
                  rows={1}
                />
              </div>
            </div>

            {!isStreaming ? (
              <Button
                type="submit"
                size="icon-lg"
                disabled={disabled || !input.trim()}
                className="h-[60px] w-[60px] shrink-0 border border-primary/50 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-lg"
                onClick={onStop}
                variant="destructive"
                className="h-[60px] w-[60px] shrink-0 border border-destructive/50 bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 hover:shadow-sm transition-all"
              >
                <Square className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono">Shift + Enter</kbd> for new line
              </p>
            </div>
            <div className="flex items-center gap-3">
              {input.length > 0 && (
                <span className="text-[10px] text-muted-foreground/70">{input.length} chars</span>
              )}
              {disabled && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  <span>API key required</span>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
