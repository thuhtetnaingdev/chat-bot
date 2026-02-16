import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import { type Conversation } from '@/types'
import { Bot } from 'lucide-react'

interface ChatContainerProps {
  conversation: Conversation | null
  isStreaming: boolean
  apiKey?: string
}

export function ChatContainer({ conversation, isStreaming, apiKey }: ChatContainerProps) {
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

  const lastMessage = conversation.messages[conversation.messages.length - 1]
  const isLastMessageEmpty = lastMessage?.role === 'assistant' && !lastMessage?.content?.trim()
  const showLoading = isStreaming && isLastMessageEmpty

  // Filter out the last empty message when showing loading
  const messagesToShow = showLoading 
    ? conversation.messages.slice(0, -1) 
    : conversation.messages

  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="flex max-w-4xl flex-col mx-auto px-4 py-4">
          {messagesToShow.map((message) => (
            <MessageBubble key={message.id} message={message} apiKey={apiKey} />
          ))}
          {showLoading && (
            <div className="flex w-full gap-3 py-3 justify-start">
              <div className="flex gap-2 max-w-[90%] md:max-w-[80%] flex-row">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card border-border/50">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {lastMessage?.model ? lastMessage.model.split('/').pop() : 'Assistant'}
                    <span className="text-[10px] opacity-50">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
