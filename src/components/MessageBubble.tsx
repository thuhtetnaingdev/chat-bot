import { type Message } from '@/types'
import { useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Brain, Terminal, User, Loader2, Volume2, VolumeX, ImageIcon, Video, Download, Sparkles, CheckCircle, XCircle, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { textToSpeech } from '@/lib/api'

interface MessageBubbleProps {
  message: Message
  apiKey?: string
}

// Image Preview Modal Component
function ImagePreviewModal({ src, isOpen, onClose }: { src: string; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <img
          src={src}
          alt="Preview"
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute -top-12 right-0 h-10 w-10 text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}

function parseThinkingContent(content: string): {
  thinking: string | null
  response: string
  isThinking: boolean
} {
  // Check if currently thinking (has <think> but no </think> yet)
  const hasOpenThink = /<think>/i.test(content)
  const hasCloseThink = /<\/think>/i.test(content)

  if (hasOpenThink && !hasCloseThink) {
    // Currently thinking - extract content after <think>
    const thinkMatch = content.match(/<think>([\s\S]*)/i)
    const thinking = thinkMatch ? thinkMatch[1].trim() : ''
    return {
      thinking: thinking || null,
      response: '',
      isThinking: true,
    }
  }

  // Completed thinking - split at first </think>
  const closeIndex = content.search(/<\/think>/i)
  if (closeIndex !== -1) {
    const beforeClose = content.substring(0, closeIndex)
    const afterClose = content.substring(closeIndex + 8).trim() // 8 is length of '</think>'

    // Extract thinking content (between <think> and </think>)
    const thinkMatch = beforeClose.match(/<think>([\s\S]*)/i)
    const thinking = thinkMatch ? thinkMatch[1].trim() : beforeClose.trim()

    // Only show thinking section if there's actual content after </think>
    // Otherwise, treat everything as response (model doesn't have separate thinking)
    if (afterClose) {
      return {
        thinking: thinking || null,
        response: afterClose,
        isThinking: false,
      }
    } else {
      // No content after </think>, treat as regular response
      return {
        thinking: null,
        response: thinking,
        isThinking: false,
      }
    }
  }

  // No think tags at all
  return {
    thinking: null,
    response: content,
    isThinking: false,
  }
}

// Strip markdown formatting for TTS
function stripMarkdown(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic markers
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/___/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove links - keep the text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Remove horizontal rules
    .replace(/^-{3,}$/gm, '')
    .replace(/^\*{3,}$/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function MessageBubble({ message, apiKey }: MessageBubbleProps) {
  const contentText = typeof message.content === 'string' ? message.content : ''
  const { thinking, response, isThinking } = parseThinkingContent(contentText)
  // Auto-expand thinking while streaming, collapse when done
  const [showThinking, setShowThinking] = useState(() => isThinking)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoadingTTS, setIsLoadingTTS] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isUser = message.role === 'user'

  // Download generated image
  const handleDownloadImage = (imageData: string, index: number) => {
    const link = document.createElement('a')
    link.href = imageData
    link.download = `generated-image-${index}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download generated video
  const handleDownloadVideo = (videoData: string, index: number) => {
    const link = document.createElement('a')
    link.href = videoData
    link.download = `generated-video-${index}-${Date.now()}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSpeak = async () => {
    if (!apiKey || !response) return

    // If already playing, stop it
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsSpeaking(false)
      return
    }

    setIsLoadingTTS(true)
    try {
      // Strip markdown before sending to TTS
      const plainText = stripMarkdown(response)
      const audioBlob = await textToSpeech(plainText, apiKey)
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
      
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      
      setIsSpeaking(true)
      await audio.play()
    } catch (error) {
      console.error('TTS error:', error)
    } finally {
      setIsLoadingTTS(false)
    }
  }

  return (
    <>
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
                  <div className="flex flex-col gap-2">
                    {typeof message.content === 'string' && message.content && (
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">{message.content}</p>
                    )}
                    {message.images && message.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.images.map((img, index) => (
                          <img
                            key={index}
                            src={img}
                            alt={`Uploaded ${index + 1}`}
                            className="max-h-32 max-w-full rounded-lg border border-border/50 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setPreviewImage(img)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Tool Status Badge */}
                    {message.activeTool && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 w-fit">
                        {message.activeTool === 'create_video' ? (
                          <Video className="h-3.5 w-3.5 text-primary" />
                        ) : message.activeTool === 'agentic_image' ? (
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        ) : message.activeTool === 'agentic_video' ? (
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="text-xs font-medium text-primary">
                          {message.activeTool === 'create_image' ? 'Create Image' : message.activeTool === 'create_video' ? 'Create Video' : message.activeTool === 'agentic_image' ? 'Agentic Image' : message.activeTool === 'agentic_video' ? 'Agentic Video' : message.activeTool}
                        </span>
                        {message.toolStatus === 'pending' && (
                          <Loader2 className="h-3 w-3 text-primary animate-spin" />
                        )}
                        {message.toolStatus === 'error' && (
                          <span className="text-xs text-destructive">Failed</span>
                        )}
                        {message.toolStatus === 'success' && (
                          <span className="text-xs text-green-600 dark:text-green-400">Done</span>
                        )}
                      </div>
                    )}

                    {/* Agentic Image Iterations */}
                    {message.agenticIterations && message.agenticIterations.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Refinement Process ({message.agenticIterations.length} iteration{message.agenticIterations.length > 1 ? 's' : ''})</span>
                        </div>
                        <div className="space-y-3">
                          {message.agenticIterations.map((iteration, index) => (
                            <div key={index} className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/30">
                                <div className="flex items-center gap-2">
                                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium">Iteration {iteration.iterationNumber}</span>
                                </div>
                                {iteration.visionFeedback.satisfied ? (
                                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span className="text-xs">Satisfied</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span className="text-xs">Needs improvement</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-3 space-y-2">
                                <img
                                  src={iteration.image}
                                  alt={`Iteration ${iteration.iterationNumber}`}
                                  className="w-full h-auto max-h-48 object-contain rounded border border-border/30 cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImage(iteration.image)}
                                />
                                {iteration.visionFeedback.issues.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Issues: </span>
                                    {iteration.visionFeedback.issues.join(', ')}
                                  </div>
                                )}
                                {iteration.visionFeedback.suggestedEdit && !iteration.visionFeedback.satisfied && (
                                  <div className="text-xs text-primary/80">
                                    <span className="font-medium">Edit prompt: </span>
                                    {iteration.visionFeedback.suggestedEdit}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Agentic Video Iterations */}
                    {message.agenticVideoIterations && message.agenticVideoIterations.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Refinement Process ({message.agenticVideoIterations.length} iteration{message.agenticVideoIterations.length > 1 ? 's' : ''})</span>
                        </div>
                        <div className="space-y-3">
                          {message.agenticVideoIterations.map((iteration, index) => (
                            <div key={index} className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/30">
                                <div className="flex items-center gap-2">
                                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium">Iteration {iteration.iterationNumber}</span>
                                </div>
                                {iteration.visionFeedback.satisfied ? (
                                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span className="text-xs">Satisfied</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span className="text-xs">Needs improvement</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-3 space-y-2">
                                <video
                                  src={iteration.video}
                                  controls
                                  className="w-full h-auto max-h-48 object-contain rounded border border-border/30"
                                  preload="metadata"
                                />
                                {iteration.visionFeedback.issues.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Issues: </span>
                                    {iteration.visionFeedback.issues.join(', ')}
                                  </div>
                                )}
                                {iteration.visionFeedback.suggestedEdit && !iteration.visionFeedback.satisfied && (
                                  <div className="text-xs text-primary/80">
                                    <span className="font-medium">Edit prompt: </span>
                                    {iteration.visionFeedback.suggestedEdit}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generated Images - only show if no agentic iterations or if completed */}
                    {message.generatedImages && message.generatedImages.length > 0 && 
                     (!message.agenticIterations || message.agenticIterations.length === 0 || message.toolStatus === 'success') && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Generated Image</span>
                          {message.toolStatus === 'pending' && (
                            <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                          )}
                        </div>
                        <div className="grid gap-3">
                          {message.generatedImages.map((img, index) => (
                            <div key={index} className="relative group rounded-lg border border-border/50 overflow-hidden bg-muted/30">
                              <img
                                src={img}
                                alt={`Generated ${index + 1}`}
                                className="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setPreviewImage(img)}
                              />
                              {message.toolStatus === 'success' && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleDownloadImage(img, index)}
                                  className="absolute bottom-2 right-2 h-8 px-3 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generated Videos - only show if no agentic video iterations or if completed */}
                    {message.generatedVideos && message.generatedVideos.length > 0 && 
                     (!message.agenticVideoIterations || message.agenticVideoIterations.length === 0 || message.toolStatus === 'success') && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Generated Video</span>
                          {message.toolStatus === 'pending' && (
                            <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                          )}
                        </div>
                        <div className="grid gap-3">
                          {message.generatedVideos.map((video, index) => (
                            <div key={index} className="relative group rounded-lg border border-border/50 overflow-hidden bg-muted/30">
                              <video
                                src={video}
                                controls
                                className="w-full h-auto max-h-96 object-contain"
                                preload="metadata"
                              />
                              {message.toolStatus === 'success' && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleDownloadVideo(video, index)}
                                  className="absolute bottom-2 right-2 h-8 px-3 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {thinking && (
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowThinking(!showThinking)}
                          className="h-7 px-2 py-0 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent hover:border-border/50"
                        >
                          {isThinking ? (
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          ) : (
                            <Brain className="h-3 w-3 mr-1.5" />
                          )}
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
                            {isThinking && (
                              <span className="inline-block w-2 h-4 bg-primary/60 ml-0.5 animate-pulse" />
                            )}
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
                    
                    {/* TTS Button */}
                    {apiKey && response && (
                      <div className="flex justify-start pt-2 mt-2 border-t border-border/30">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSpeak}
                          disabled={isLoadingTTS}
                          className={cn(
                            'h-7 px-2 py-0 text-xs font-medium',
                            isSpeaking 
                              ? 'text-primary hover:text-primary/80 hover:bg-primary/10' 
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                          )}
                        >
                          {isLoadingTTS ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : isSpeaking ? (
                            <VolumeX className="h-3.5 w-3.5 mr-1.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {isLoadingTTS ? 'Generating...' : isSpeaking ? 'Stop' : 'Listen'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      <ImagePreviewModal 
        src={previewImage || ''} 
        isOpen={!!previewImage} 
        onClose={() => setPreviewImage(null)} 
      />
    </>
  )
}
