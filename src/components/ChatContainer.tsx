import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import { type Conversation } from '@/types'

interface ChatContainerProps {
  conversation: Conversation | null
  isStreaming: boolean
  apiKey?: string
  isProcessingRPG?: boolean
  onRPGSubmit?: (prompt: string) => void
  onRPGToggleChaos?: (enabled: boolean) => void
  onRPGStop?: () => void
  onRPGComplete?: () => void
}

export function ChatContainer({
  conversation,
  isStreaming,
  apiKey,
  isProcessingRPG,
  onRPGSubmit,
  onRPGToggleChaos,
  onRPGStop,
  onRPGComplete
}: ChatContainerProps) {
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
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-foreground mb-2">What can I help with?</h1>
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
        <div className="flex max-w-3xl flex-col mx-auto px-4 py-6">
          {messagesToShow.map((message, index) => (
            <div
              key={message.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <MessageBubble
                message={message}
                apiKey={apiKey}
                isProcessingRPG={isProcessingRPG}
                onRPGSubmit={onRPGSubmit}
                onRPGToggleChaos={onRPGToggleChaos}
                onRPGStop={onRPGStop}
                onRPGComplete={onRPGComplete}
              />
            </div>
          ))}
          {showLoading && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex w-full gap-4 py-4 justify-start">
                <div className="flex gap-3 max-w-[90%] md:max-w-[80%] flex-row">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-primary text-xs font-medium">AI</span>
                  </div>
                  <div className="flex flex-col gap-2 min-w-0 max-w-full overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
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
