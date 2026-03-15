import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import { type Conversation } from '@/types'
import { Bot, Wand2, MessageSquare, Zap } from 'lucide-react'

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
        {/* Central content - Clean and minimal */}
        <div className="text-center space-y-6 max-w-md px-6">
          {/* Icon following design system */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
            <div className="relative w-20 h-20 mx-auto rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center shadow-lg">
              <Bot className="w-10 h-10 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              What can I help with?
            </h2>
            <p className="text-muted-foreground text-sm">
              Ask anything, generate images, or analyze videos
            </p>
          </div>

          {/* Simple feature hints */}
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {[
              { icon: Wand2, text: 'Create images' },
              { icon: Zap, text: 'Write code' },
              { icon: MessageSquare, text: 'Ask questions' },
            ].map((item, i) => (
              <div 
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-xs text-muted-foreground"
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const lastMessage = conversation.messages[conversation.messages.length - 1]
  const lastMessageContent = typeof lastMessage?.content === 'string' ? lastMessage.content : ''
  const isLastMessageEmpty = lastMessage?.role === 'assistant' && !lastMessageContent.trim()
  const showLoading = isStreaming && isLastMessageEmpty

  const messagesToShow = showLoading ? conversation.messages.slice(0, -1) : conversation.messages

  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="flex max-w-4xl flex-col mx-auto px-4 py-8">
          {messagesToShow.map((message, index) => (
            <div 
              key={message.id} 
              className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <MessageBubble message={message} apiKey={apiKey} />
            </div>
          ))}
          {showLoading && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex w-full gap-4 py-4 justify-start">
                <div className="flex gap-3 max-w-[90%] md:max-w-[80%] flex-row">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex flex-col gap-2 min-w-0 max-w-full overflow-hidden">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      {lastMessage?.model ? lastMessage.model.split('/').pop() : 'Assistant'}
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl rounded-tl-md bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground">Thinking...</span>
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
