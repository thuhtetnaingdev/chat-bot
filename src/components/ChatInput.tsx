import {
  useState,
  type KeyboardEvent,
  type FormEvent,
  useRef,
  useEffect,
  type ChangeEvent
} from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Paperclip, X, ImageIcon, Mic, ArrowUp } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { transcribeAudio, processImageFile, performOCR } from '@/lib/api'
import { availableTools, type Tool, IMAGE_MODELS, type Model } from '@/types'
import { cn } from '@/lib/utils'

export interface ChatInputProps {
  onSend: (
    message: string,
    images?: string[],
    activeTool?: string,
    visionModel?: string,
    imageModel?: string,
    videoResolution?: string,
    maxAgenticIterations?: number
  ) => Promise<void>
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  apiKey?: string
  isThinking: boolean
  selectedImageModel?: string
  onImageModelChange?: (model: string) => void
  selectedVisionModel?: string
  onVisionModelChange?: (model: string) => void
  selectedVideoResolution?: string
  onVideoResolutionChange?: (resolution: string) => void
  maxAgenticIterations?: number
  onMaxAgenticIterationsChange?: (value: number) => void
  models?: Model[]
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  apiKey = '',
  selectedImageModel = 'glm-image',
  onImageModelChange,
  selectedVisionModel = '',
  onVisionModelChange,
  models = []
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [isProcessingOCR, setIsProcessingOCR] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Tool suggestion state
  const [showToolSuggestions, setShowToolSuggestions] = useState(false)
  const [toolSearchQuery, setToolSearchQuery] = useState('')
  const [selectedToolIndex, setSelectedToolIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)

  const {
    isRecording,
    audioBlob,
    error: recordingError,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder()

  const streamRef = useRef<MediaStream | null>(null)
  const processedBlobRef = useRef<string | null>(null)

  // Handle transcription when audioBlob becomes available
  useEffect(() => {
    const processTranscription = async () => {
      if (audioBlob && apiKey && !isTranscribing) {
        const blobId = `${audioBlob.size}-${audioBlob.type}-${Date.now()}`
        if (processedBlobRef.current === blobId) return

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

  // Get vision-supported models
  const visionModels = models.filter(m => m.modalities?.input?.includes('image'))
  const effectiveVisionModel =
    selectedVisionModel || (visionModels.length > 0 ? visionModels[0].id : '')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (
      (input.trim() || selectedImages.length > 0) &&
      !isStreaming &&
      !disabled &&
      !isTranscribing &&
      !isProcessingOCR
    ) {
      const activeTool = getActiveTool()

      // Handle different tools
      if (activeTool === 'vision') {
        if (selectedImages.length === 0) {
          setTranscriptionError('Please upload at least one image for vision analysis')
          return
        }
        await onSend(
          input.trim(),
          selectedImages,
          activeTool,
          effectiveVisionModel,
          selectedImageModel
        )
        setInput('')
        setSelectedImages([])
        return
      }

      if (activeTool === 'edit_image') {
        if (selectedImages.length === 0) {
          setTranscriptionError('Please upload at least one image to edit')
          return
        }
        await onSend(input.trim(), selectedImages, activeTool, undefined, selectedImageModel)
        setInput('')
        setSelectedImages([])
        return
      }

      if (activeTool === 'create_video') {
        await onSend(
          input.trim(),
          selectedImages.length > 0 ? selectedImages : undefined,
          activeTool,
          undefined,
          selectedImageModel
        )
        setInput('')
        setSelectedImages([])
        return
      }

      if (activeTool === 'agentic_image') {
        await onSend(
          input.trim(),
          selectedImages.length > 0 ? selectedImages : undefined,
          activeTool,
          effectiveVisionModel,
          selectedImageModel,
          undefined,
          3
        )
        setInput('')
        setSelectedImages([])
        return
      }

      if (activeTool === 'agentic_video') {
        if (selectedImages.length === 0) {
          setTranscriptionError('Please upload at least one image for agentic video generation')
          return
        }
        await onSend(
          input.trim(),
          selectedImages,
          activeTool,
          effectiveVisionModel,
          undefined,
          '480p',
          3
        )
        setInput('')
        setSelectedImages([])
        return
      }

      // Standard text/image processing with OCR
      if (selectedImages.length > 0 && apiKey) {
        setIsProcessingOCR(true)
        try {
          const ocrResults: string[] = []
          for (const img of selectedImages) {
            let ocrText = ''
            await performOCR(img, apiKey, chunk => {
              ocrText += chunk
            })
            if (ocrText.trim()) {
              ocrResults.push(ocrText.trim())
            }
          }

          let finalMessage = input.trim()
          if (ocrResults.length > 0) {
            const ocrCombined = ocrResults.join('\n\n')
            if (finalMessage) {
              finalMessage = `${finalMessage}\n\n[Image Text]:\n${ocrCombined}`
            } else {
              finalMessage = `[Image Text]:\n${ocrCombined}`
            }
          }

          await onSend(finalMessage, selectedImages, activeTool)
          setInput('')
          setSelectedImages([])
        } catch (error) {
          console.error('OCR error:', error)
          setTranscriptionError('Failed to process image OCR')
        } finally {
          setIsProcessingOCR(false)
        }
      } else {
        await onSend(input.trim(), undefined, activeTool)
        setInput('')
      }
    }
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const images: string[] = []
    const activeTool = getActiveTool()
    const isVisionMode = activeTool === 'vision'

    try {
      for (const file of Array.from(files)) {
        if (isVisionMode) {
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
        } else {
          if (!file.type.startsWith('image/')) continue
        }

        const base64 = await processImageFile(file)
        images.push(base64)
      }

      setSelectedImages(prev => [...prev, ...images])
    } catch (error) {
      console.error('File processing error:', error)
      setTranscriptionError('Failed to process file')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleFileButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showToolSuggestions && filteredTools.length > 0) {
      handleToolKeyDown(e)
      return
    }

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

  // Detect tool mentions (@tool_name)
  useEffect(() => {
    const lastAtIndex = input.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const textAfterAt = input.slice(lastAtIndex + 1)
      const spaceIndex = textAfterAt.search(/\s/)

      if (spaceIndex === -1 || cursorPosition <= lastAtIndex + 1 + textAfterAt.length) {
        setMentionStartIndex(lastAtIndex)
        setToolSearchQuery(textAfterAt.toLowerCase())
        setShowToolSuggestions(true)
        setSelectedToolIndex(0)
      } else {
        setShowToolSuggestions(false)
      }
    } else {
      setShowToolSuggestions(false)
    }
  }, [input, cursorPosition])

  // Filter tools based on search query
  const filteredTools = availableTools.filter(
    tool =>
      tool.name.toLowerCase().includes(toolSearchQuery) ||
      tool.id.toLowerCase().includes(toolSearchQuery)
  )

  // Insert tool mention
  const insertToolMention = (tool: Tool) => {
    if (mentionStartIndex !== -1) {
      const beforeMention = input.slice(0, mentionStartIndex)
      const afterMention = input.slice(mentionStartIndex + 1 + toolSearchQuery.length)
      const newInput = `${beforeMention}@${tool.id} ${afterMention}`
      setInput(newInput)
      setShowToolSuggestions(false)

      setTimeout(() => {
        textareaRef.current?.focus()
        const newCursorPos = mentionStartIndex + tool.id.length + 2
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    }
  }

  // Handle tool suggestion keyboard navigation
  const handleToolKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showToolSuggestions && filteredTools.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedToolIndex(prev => (prev + 1) % filteredTools.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedToolIndex(prev => (prev - 1 + filteredTools.length) % filteredTools.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertToolMention(filteredTools[selectedToolIndex])
      } else if (e.key === 'Escape') {
        setShowToolSuggestions(false)
      }
    }
  }

  // Handle input change with cursor tracking
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    setCursorPosition(e.target.selectionStart)
  }

  // Handle click in textarea
  const handleTextareaClick = () => {
    setCursorPosition(textareaRef.current?.selectionStart || 0)
  }

  // Extract active tool from input
  const getActiveTool = (): string | undefined => {
    for (const tool of availableTools) {
      if (input.includes(`@${tool.id}`)) {
        return tool.id
      }
    }
    return undefined
  }

  const activeTool = getActiveTool()

  const isInputDisabled =
    disabled || isStreaming || isTranscribing || isRecording || isProcessingOCR

  return (
    <div className="border-t border-border/50 bg-background">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Error Message */}
        {(transcriptionError || recordingError) && (
          <div className="mb-3 flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive line-clamp-2">
              {transcriptionError || recordingError}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearError}
              className="h-7 text-xs hover:bg-destructive/20 shrink-0"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedImages.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={img}
                  alt={`Selected ${index + 1}`}
                  className="h-14 w-14 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tool-specific UI */}
        {activeTool === 'create_image' && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Image Model:</span>
            <Select value={selectedImageModel} onValueChange={onImageModelChange}>
              <SelectTrigger className="h-7 w-[140px] text-xs border-0 bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id} className="text-xs">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {activeTool === 'vision' && visionModels.length > 0 && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Vision Model:</span>
            <Select value={effectiveVisionModel} onValueChange={onVisionModelChange}>
              <SelectTrigger className="h-7 w-[160px] text-xs border-0 bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visionModels.map(model => (
                  <SelectItem key={model.id} value={model.id} className="text-xs">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Main Input */}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full bg-muted/50 border border-border/50 p-2 transition-all',
                'focus-within:border-primary/50 focus-within:bg-muted'
              )}
            >
              {/* File Upload Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept={activeTool === 'vision' ? 'image/*,video/*' : 'image/*'}
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleFileButtonClick}
                disabled={disabled || isStreaming || isRecording || isTranscribing || !apiKey}
                className="h-9 w-9 rounded-full shrink-0 hover:bg-muted-foreground/10"
              >
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              </Button>

              {/* Text Input */}
              <div className="flex-1 min-w-0 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onClick={handleTextareaClick}
                  placeholder={
                    isRecording
                      ? 'Recording...'
                      : isProcessingOCR
                        ? 'Extracting text...'
                        : 'How can I help you today?'
                  }
                  disabled={isInputDisabled}
                  className="w-full min-h-[40px] max-h-[120px] resize-none bg-transparent border-0 px-1 py-0 text-sm leading-[40px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                  rows={1}
                  onInput={e => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                  }}
                />

                {/* Tool Suggestions Popup */}
                {showToolSuggestions && filteredTools.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="px-3 py-2 bg-muted/50 border-b border-border">
                      <p className="text-xs text-muted-foreground font-medium">Tools</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredTools.map((tool, index) => (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => insertToolMention(tool)}
                          className={cn(
                            'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                            index === selectedToolIndex
                              ? 'bg-primary/20 hover:bg-primary/30'
                              : 'hover:bg-muted'
                          )}
                        >
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <ImageIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tool.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {tool.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Voice Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={disabled || isStreaming || isTranscribing}
                className={cn(
                  'h-9 w-9 rounded-full shrink-0',
                  isRecording
                    ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                    : 'hover:bg-muted-foreground/10'
                )}
              >
                <Mic className={cn('h-5 w-5', isRecording && 'animate-pulse')} />
              </Button>

              {/* Send Button */}
              {!isStreaming ? (
                <Button
                  type="submit"
                  disabled={
                    disabled ||
                    (!input.trim() && selectedImages.length === 0) ||
                    isRecording ||
                    isTranscribing ||
                    isProcessingOCR
                  }
                  className="h-9 w-9 rounded-full shrink-0 p-0 bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onStop}
                  variant="destructive"
                  className="h-9 w-9 rounded-full shrink-0 p-0"
                >
                  <div className="h-3 w-3 bg-white rounded-sm" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
