import { type Message } from '@/types'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Brain, Terminal, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MessageBubbleProps {
  message: Message
}

function parseThinkingContent(content: string): { thinking: string | null, response: string } {
  const thinkPattern = /<think>([\s\S]*?)<\/think>/i
  const thinkMatch = content.match(thinkPattern)
  if (thinkMatch) {
    return {
      thinking: thinkMatch[1].trim(),
      response: content.replace(thinkPattern, '').trim()
    }
  }
  return {
    thinking: null,
    response: content
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [showThinking, setShowThinking] = useState(false)
  const isUser = message.role === 'user'
  
  const { thinking, response } = parseThinkingContent(message.content)

  return (
    <div className={cn('flex w-full gap-3 py-3', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex gap-2 max-w-[90%] md:max-w-[80%]', isUser ? 'flex-row-reverse' : 'flex-row')}>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', isUser ? 'bg-primary text-primary-foreground border-primary/50' : 'bg-card border-border/50')}>
          {isUser ? <User className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
        </div>
        
        <div className="flex flex-col gap-1.5 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {isUser ? 'You' : (message.model ? message.model.split('/').pop() : 'Assistant')}
            <span className="text-[10px] opacity-50">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <Card
            className={cn(
              'border border-border/50 shadow-xs',
              isUser 
                ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20' 
                : 'bg-card/50 backdrop-blur-sm border-border/30'
            )}
          >
            <div className={isUser ? 'px-3 py-2' : 'p-4'}>
              {isUser ? (
                <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">{message.content}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {thinking && (
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowThinking(!showThinking)}
                        className="h-7 px-2 py-0 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent hover:border-border/50"
                      >
                        <Brain className="h-3 w-3 mr-1.5" />
                        Thinking Process
                        {showThinking ? (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronRight className="h-3 w-3 ml-1" />
                        )}
                      </Button>
                      {showThinking && (
                        <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed font-mono">
                            {thinking}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="prose prose-sm dark:prose-invert max-w-none" style={{ overflowWrap: 'anywhere' }}>
                    <ReactMarkdown
                      components={{
                        code(prop) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const { inline, className, children } = prop as any
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <div className="my-3 rounded-lg overflow-hidden border border-border/50">
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  margin: 0,
                                  borderRadius: '0',
                                  fontSize: '0.813rem'
                                }}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code
                              className={cn(
                                'rounded-md px-1.5 py-0.5 text-xs font-mono',
                                'bg-accent/50 border border-border/50 text-accent-foreground'
                              )}
                            >
                              {children}
                            </code>
                          )
                        },
                        p({ children }) {
                          return <p className="mb-2 last:mb-0 leading-relaxed text-sm" style={{ overflowWrap: 'anywhere' }}>{children}</p>
                        },
                        ul({ children }) {
                          return <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>
                        },
                        ol({ children }) {
                          return <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
                        },
                        li({ children }) {
                          return <li className="leading-relaxed text-sm" style={{ overflowWrap: 'anywhere' }}>{children}</li>
                        },
                        h1({ children }) {
                          return <h1 className="mb-2 mt-3 text-lg font-bold">{children}</h1>
                        },
                        h2({ children }) {
                          return <h2 className="mb-2 mt-2 text-base font-bold">{children}</h2>
                        },
                        h3({ children }) {
                          return <h3 className="mb-1 mt-1 text-sm font-semibold">{children}</h3>
                        },
                        blockquote({ children }) {
                          return (
                            <blockquote className="mb-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">
                              {children}
                            </blockquote>
                          )
                        },
                        a({ href, children }) {
                          return (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline underline-offset-2 text-xs hover:text-primary/80"
                              style={{ overflowWrap: 'anywhere' }}
                            >
                              {children}
                            </a>
                          )
                        }
                      }}
                    >
                      {response}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
