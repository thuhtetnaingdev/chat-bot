import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import { type Conversation } from '@/types'
import { Bot, Sparkles } from 'lucide-react'

interface ChatContainerProps {
  conversation: Conversation | null
  isStreaming: boolean
}

export function ChatContainer({ conversation, isStreaming }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation?.messages, isStreaming])

  if (!conversation || conversation.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-gradient-to-br from-primary/20 to-primary/5">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Start a Conversation
            </span>
          </h2>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <p>Ask anything and I'll help you find answers.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-4">
            <div className="px-3 py-1.5 text-xs rounded-full border border-border/50 bg-muted/40 text-muted-foreground">
              💡 Explain concepts
            </div>
            <div className="px-3 py-1.5 text-xs rounded-full border border-border/50 bg-muted/40 text-muted-foreground">
              📝 Write code
            </div>
            <div className="px-3 py-1.5 text-xs rounded-full border border-border/50 bg-muted/40 text-muted-foreground">
              🎨 Brainstorm ideas
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="flex max-w-4xl flex-col mx-auto px-4 py-4">
          {conversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
