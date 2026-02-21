import { type Message } from '@/types'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Bot,
  User,
  Loader2,
  Volume2,
  VolumeX,
  ImageIcon,
  Video,
  Download,
  Sparkles,
  CheckCircle,
  XCircle,
  RefreshCw,
  X
} from 'lucide-react'
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
function ImagePreviewModal({
  src,
  isOpen,
  onClose
}: {
  src: string
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-8 bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Header with close button */}
      <div className="w-full max-w-[90vw] flex items-center justify-between mb-4">
        <span className="text-white/60 text-sm">Image Preview</span>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image container */}
      <div 
        className="relative max-w-[90vw] max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          alt="Preview"
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Footer hint */}
      <p className="mt-4 text-white/40 text-sm">Click anywhere to close</p>
    </div>,
    document.body
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
      isThinking: true
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
        isThinking: false
      }
    } else {
      // No content after </think>, treat as regular response
      return {
        thinking: null,
        response: thinking,
        isThinking: false
      }
    }
  }

  // No think tags at all
  return {
    thinking: null,
    response: content,
    isThinking: false
  }
}

// Strip markdown formatting for TTS
function stripMarkdown(text: string): string {
  return (
    text
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
  )
}

export function MessageBubble({ message, apiKey }: MessageBubbleProps) {
  const contentText = typeof message.content === 'string' ? message.content : ''
  const { thinking, response, isThinking } = parseThinkingContent(contentText)
  // Auto-expand thinking while streaming, collapse when done
  const [showThinking, setShowThinking] = useState(() => isThinking)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoadingTTS, setIsLoadingTTS] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [currentIterationIndex, setCurrentIterationIndex] = useState(0)
  const [showAnalysis, setShowAnalysis] = useState(false)
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
        <div
          className={cn(
            'flex gap-3 max-w-[90%] md:max-w-[80%]',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm',
              isUser
                ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary/50 shadow-primary/20'
                : 'bg-gradient-to-br from-card to-card border-border/50 shadow-sm'
            )}
          >
            {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5 text-primary" />}
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 max-w-full overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
              {isUser ? 'You' : message.model ? message.model.split('/').pop() : 'Assistant'}
              <span className="text-[10px] opacity-50">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            <Card
              className={cn(
                'border shadow-sm',
                isUser
                  ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 rounded-2xl rounded-tr-md'
                  : 'bg-gradient-to-br from-card via-card to-muted/10 border-border/30 rounded-2xl rounded-tl-md'
              )}
            >
              <div className={isUser ? 'px-3 py-2' : 'p-4'}>
                {isUser ? (
                  <div className="flex flex-col gap-2">
                    {typeof message.content === 'string' && message.content && (
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">
                        {message.content}
                      </p>
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
                          {message.activeTool === 'create_image'
                            ? 'Create Image'
                            : message.activeTool === 'create_video'
                              ? 'Create Video'
                              : message.activeTool === 'agentic_image'
                                ? 'Agentic Image'
                                : message.activeTool === 'agentic_video'
                                  ? 'Agentic Video'
                                  : message.activeTool}
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
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Refinement Process ({message.agenticIterations.length} iteration
                            {message.agenticIterations.length > 1 ? 's' : ''})
                          </span>
                        </div>

                        {/* Image Analysis Display - Uses message.imageAnalysis */}
                        {(message.imageAnalysis || message.agenticIterations[0]?.imageAnalysis) && (
                          <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                            <button
                              onClick={() => setShowAnalysis(!showAnalysis)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted/70 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-primary" />
                                <span className="text-xs font-medium">📊 Analysis Results</span>
                              </div>
                              {showAnalysis ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>

                            {showAnalysis && (
                              <div className="p-3 space-y-4 text-xs">
                                {(message.imageAnalysis ||
                                  message.agenticIterations![0].imageAnalysis!)!.faces.length >
                                  0 && (
                                  <div>
                                    <span className="font-medium text-foreground">
                                      👤 Faces Detected:
                                    </span>
                                    <ul className="mt-1 space-y-1 ml-1">
                                      {(message.imageAnalysis ||
                                        message.agenticIterations![0].imageAnalysis!)!.faces.map(
                                        face => (
                                          <li key={face.id} className="text-muted-foreground">
                                            • Face {face.id}: {face.description} ({face.location})
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}

                                {(message.imageAnalysis ||
                                  message.agenticIterations![0].imageAnalysis!)!.clothing.length >
                                  0 && (
                                  <div>
                                    <span className="font-medium text-foreground">
                                      👕 Clothing:
                                    </span>
                                    <ul className="mt-1 space-y-1 ml-1">
                                      {(message.imageAnalysis ||
                                        message.agenticIterations![0].imageAnalysis!)!.clothing.map(
                                        (item, idx) => (
                                          <li key={idx} className="text-muted-foreground">
                                            • {item.color} {item.item} ({item.location})
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}

                                {(message.imageAnalysis ||
                                  message.agenticIterations![0].imageAnalysis!)!.background && (
                                  <div>
                                    <span className="font-medium text-foreground">
                                      🖼️ Background:
                                    </span>
                                    <p className="mt-1 text-muted-foreground ml-1">
                                      {
                                        (message.imageAnalysis ||
                                          message.agenticIterations![0].imageAnalysis!)!.background
                                      }
                                    </p>
                                  </div>
                                )}

                                {(message.imageAnalysis ||
                                  message.agenticIterations![0].imageAnalysis!)!.keyObjects.length >
                                  0 && (
                                  <div>
                                    <span className="font-medium text-foreground">
                                      📦 Key Objects:
                                    </span>
                                    <p className="mt-1 text-muted-foreground ml-1">
                                      {(message.imageAnalysis ||
                                        message.agenticIterations![0]
                                          .imageAnalysis!)!.keyObjects.join(', ')}
                                    </p>
                                  </div>
                                )}

                                {/* Preservation Instructions */}
                                {(message.imageAnalysis ||
                                  message.agenticIterations![0].imageAnalysis!)!
                                  .preservationInstructions && (
                                  <div className="pt-3 border-t border-border/30">
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                                        ⚠️ Enhanced Edit Prompt (click to expand)
                                      </summary>
                                      <div className="mt-2 p-2 bg-muted/50 rounded border border-border/30 max-h-40 overflow-y-auto">
                                        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words">
                                          {
                                            (message.imageAnalysis ||
                                              message.agenticIterations![0].imageAnalysis!)!
                                              .preservationInstructions
                                          }
                                        </pre>
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Slider Navigation */}
                        {message.agenticIterations.length > 1 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Iteration 1</span>
                              <span className="font-medium text-foreground">
                                Iteration{' '}
                                {Math.min(
                                  currentIterationIndex + 1,
                                  message.agenticIterations.length
                                )}{' '}
                                of {message.agenticIterations.length}
                              </span>
                              <span>
                                Iteration {Math.min(message.agenticIterations.length, 10)}
                              </span>
                            </div>
                            <Slider
                              value={[
                                Math.min(
                                  currentIterationIndex,
                                  message.agenticIterations.length - 1
                                )
                              ]}
                              onValueChange={value => setCurrentIterationIndex(value[0])}
                              max={Math.min(message.agenticIterations.length - 1, 9)}
                              min={0}
                              step={1}
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Current Iteration Display */}
                        {(() => {
                          const iteration =
                            message.agenticIterations![
                              Math.min(currentIterationIndex, message.agenticIterations!.length - 1)
                            ]
                          return (
                            <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/30">
                                <div className="flex items-center gap-2">
                                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium">
                                    Iteration {iteration.iterationNumber}
                                  </span>
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
                                  className="w-full h-auto max-h-64 object-contain rounded border border-border/30 cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImage(iteration.image)}
                                />
                                {iteration.visionFeedback.issues.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Issues: </span>
                                    {iteration.visionFeedback.issues.join(', ')}
                                  </div>
                                )}
                                {iteration.visionFeedback.suggestedEdit &&
                                  !iteration.visionFeedback.satisfied && (
                                    <div className="text-xs text-primary/80">
                                      <span className="font-medium">Edit prompt: </span>
                                      {iteration.visionFeedback.suggestedEdit}
                                    </div>
                                  )}

                                {/* Show Enhanced Technical Prompt for first iteration */}
                                {iteration.iterationNumber === 1 && iteration.editPrompt && (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                      <span className="font-medium">Technical Edit Prompt</span>{' '}
                                      (click to expand)
                                    </summary>
                                    <div className="mt-2 p-2 bg-muted/50 rounded border border-border/30 max-h-32 overflow-y-auto">
                                      <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words">
                                        {iteration.editPrompt}
                                      </pre>
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Agentic Video Iterations */}
                    {message.agenticVideoIterations &&
                      message.agenticVideoIterations.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Refinement Process ({message.agenticVideoIterations.length} iteration
                              {message.agenticVideoIterations.length > 1 ? 's' : ''})
                            </span>
                          </div>

                          {/* Slider Navigation */}
                          {message.agenticVideoIterations.length > 1 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Iteration 1</span>
                                <span className="font-medium text-foreground">
                                  Iteration{' '}
                                  {Math.min(
                                    currentIterationIndex + 1,
                                    message.agenticVideoIterations.length
                                  )}{' '}
                                  of {message.agenticVideoIterations.length}
                                </span>
                                <span>
                                  Iteration {Math.min(message.agenticVideoIterations.length, 10)}
                                </span>
                              </div>
                              <Slider
                                value={[
                                  Math.min(
                                    currentIterationIndex,
                                    message.agenticVideoIterations.length - 1
                                  )
                                ]}
                                onValueChange={value => setCurrentIterationIndex(value[0])}
                                max={Math.min(message.agenticVideoIterations.length - 1, 9)}
                                min={0}
                                step={1}
                                className="w-full"
                              />
                            </div>
                          )}

                          {/* Current Iteration Display */}
                          {(() => {
                            const iteration =
                              message.agenticVideoIterations![
                                Math.min(
                                  currentIterationIndex,
                                  message.agenticVideoIterations!.length - 1
                                )
                              ]
                            return (
                              <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/30">
                                  <div className="flex items-center gap-2">
                                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-medium">
                                      Iteration {iteration.iterationNumber}
                                    </span>
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
                                    className="w-full h-auto max-h-64 object-contain rounded border border-border/30"
                                    preload="metadata"
                                  />
                                  {iteration.visionFeedback.issues.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      <span className="font-medium">Issues: </span>
                                      {iteration.visionFeedback.issues.join(', ')}
                                    </div>
                                  )}
                                  {iteration.visionFeedback.suggestedEdit &&
                                    !iteration.visionFeedback.satisfied && (
                                      <div className="text-xs text-primary/80">
                                        <span className="font-medium">Edit prompt: </span>
                                        {iteration.visionFeedback.suggestedEdit}
                                      </div>
                                    )}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                    {/* Generated Images - only show if no agentic iterations or if completed */}
                    {message.generatedImages &&
                      message.generatedImages.length > 0 &&
                      (!message.agenticIterations ||
                        message.agenticIterations.length === 0 ||
                        message.toolStatus === 'success') && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Generated Image
                            </span>
                            {message.toolStatus === 'pending' && (
                              <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                            )}
                          </div>
                          <div className="grid gap-3">
                            {message.generatedImages.map((img, index) => (
                              <div
                                key={index}
                                className="relative group rounded-lg border border-border/50 overflow-hidden bg-muted/30"
                              >
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
                    {message.generatedVideos &&
                      message.generatedVideos.length > 0 &&
                      (!message.agenticVideoIterations ||
                        message.agenticVideoIterations.length === 0 ||
                        message.toolStatus === 'success') && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Generated Video
                            </span>
                            {message.toolStatus === 'pending' && (
                              <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                            )}
                          </div>
                          <div className="grid gap-3">
                            {message.generatedVideos.map((video, index) => (
                              <div
                                key={index}
                                className="relative group rounded-lg border border-border/50 overflow-hidden bg-muted/30"
                              >
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

                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      style={{ overflowWrap: 'anywhere' }}
                    >
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
                            return (
                              <p
                                className="mb-2 last:mb-0 leading-relaxed text-sm"
                                style={{ overflowWrap: 'anywhere' }}
                              >
                                {children}
                              </p>
                            )
                          },
                          ul({ children }) {
                            return <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>
                          },
                          ol({ children }) {
                            return (
                              <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
                            )
                          },
                          li({ children }) {
                            return (
                              <li
                                className="leading-relaxed text-sm"
                                style={{ overflowWrap: 'anywhere' }}
                              >
                                {children}
                              </li>
                            )
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
