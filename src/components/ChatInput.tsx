import { useState, type KeyboardEvent, type FormEvent, useRef, useEffect, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Square, ArrowUp, Paperclip, X, ImageIcon } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer'
import { AudioVisualizer } from '@/components/AudioVisualizer'
import { VoiceInputButton } from '@/components/VoiceInputButton'
import { transcribeAudio, processImageFile, performOCR } from '@/lib/api'
import { availableTools, type Tool, IMAGE_MODELS, VIDEO_RESOLUTIONS, type Model, supportsVideo } from '@/types'

export interface ChatInputProps {
  onSend: (message: string, images?: string[], activeTool?: string, visionModel?: string, imageModel?: string, videoResolution?: string) => Promise<void>
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
  models?: Model[]
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  apiKey = '',
  selectedImageModel = 'z-image-turbo',
  onImageModelChange,
  selectedVisionModel = '',
  onVisionModelChange,
  selectedVideoResolution = '480p',
  onVideoResolutionChange,
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

  // Get vision-supported models
  const visionModels = models.filter(m => m.modalities?.input?.includes('image'))

  // Get the first vision model as default if none selected
  const effectiveVisionModel = selectedVisionModel || (visionModels.length > 0 ? visionModels[0].id : '')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if ((input.trim() || selectedImages.length > 0) && !isStreaming && !disabled && !isTranscribing && !isProcessingOCR) {
      const activeTool = getActiveTool()
      
      // If using @vision tool, don't do OCR - send images to LLM directly
      if (activeTool === 'vision') {
        if (selectedImages.length === 0) {
          setTranscriptionError('Please upload at least one image for vision analysis')
          return
        }

        await onSend(input.trim(), selectedImages, activeTool, effectiveVisionModel, selectedImageModel)
        setInput('')
        setSelectedImages([])
        return
      }

      // If using @edit_image tool, don't do OCR - send images for editing
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

      // If using @create_video tool, don't do OCR - send images for video generation (optional)
      if (activeTool === 'create_video') {
        await onSend(input.trim(), selectedImages.length > 0 ? selectedImages : undefined, activeTool, undefined, selectedImageModel)
        setInput('')
        setSelectedImages([])
        return
      }

      // If using @agentic_image tool, pass images for edit mode if provided
      if (activeTool === 'agentic_image') {
        await onSend(input.trim(), selectedImages.length > 0 ? selectedImages : undefined, activeTool, effectiveVisionModel, selectedImageModel)
        setInput('')
        setSelectedImages([])
        return
      }

      // If using @agentic_video tool, images are mandatory
      if (activeTool === 'agentic_video') {
        if (selectedImages.length === 0) {
          setTranscriptionError('Please upload at least one image for agentic video generation')
          return
        }

        await onSend(input.trim(), selectedImages, activeTool, effectiveVisionModel, undefined, selectedVideoResolution)
        setInput('')
        setSelectedImages([])
        return
      }

      // If there are images, process OCR in background first (for non-vision tools)
      if (selectedImages.length > 0 && apiKey) {
        setIsProcessingOCR(true)
        try {
          // Process all images with OCR
          const ocrResults: string[] = []
          for (const img of selectedImages) {
            let ocrText = ''
            await performOCR(
              img,
              apiKey,
              (chunk) => {
                ocrText += chunk
              }
            )
            if (ocrText.trim()) {
              ocrResults.push(ocrText.trim())
            }
          }
          
          // Combine user input with OCR results
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
        // No images, just send text
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
        // For vision mode, accept both images and videos
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
      // Reset file input
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
  const filteredTools = availableTools.filter(tool => 
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
      
      // Focus textarea and set cursor after the inserted mention
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

  const isInputDisabled = disabled || isStreaming || isTranscribing || isRecording || isProcessingOCR

  return (
    <div className="border-t border-border/50 bg-card/30">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <form onSubmit={handleSubmit}>
          {/* Error Message */}
          {(transcriptionError || recordingError) && (
            <div className="mb-2 sm:mb-3 flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-[10px] sm:text-xs text-destructive line-clamp-2">
                {transcriptionError || recordingError}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearError}
                className="h-6 sm:h-7 text-[10px] sm:text-xs hover:bg-destructive/20 shrink-0"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="mb-2 sm:mb-3 flex flex-wrap gap-1.5 sm:gap-2">
              {selectedImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img}
                    alt={`Selected ${index + 1}`}
                    className="h-12 w-12 sm:h-16 sm:w-16 object-cover rounded-lg border border-border/50"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Model Selector for Image Generation */}
          {activeTool === 'create_image' && (
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Image Model:</span>
              <Select value={selectedImageModel} onValueChange={onImageModelChange}>
                <SelectTrigger className="w-[140px] sm:w-[200px] h-7 sm:h-8 text-[10px] sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-[10px] sm:text-xs">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Model Selector for Vision */}
          {activeTool === 'vision' && visionModels.length > 0 && (
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Vision Model:</span>
              <Select value={effectiveVisionModel} onValueChange={onVisionModelChange}>
                <SelectTrigger className="w-[140px] sm:w-[200px] h-7 sm:h-8 text-[10px] sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visionModels.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-[10px] sm:text-xs">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resolution Selector for Video Generation */}
          {activeTool === 'create_video' && (
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Resolution:</span>
              <Select value={selectedVideoResolution} onValueChange={onVideoResolutionChange}>
                <SelectTrigger className="w-[100px] sm:w-[120px] h-7 sm:h-8 text-[10px] sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_RESOLUTIONS.map((res) => (
                    <SelectItem key={res.id} value={res.id} className="text-[10px] sm:text-xs">
                      {res.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Model Selectors for Agentic Image */}
          {activeTool === 'agentic_image' && (
            <div className="mb-2 flex flex-wrap items-center gap-3 px-1">
              {/* Show Image Model only when no images uploaded (create mode) */}
              {selectedImages.length === 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Image Model:</span>
                  <Select value={selectedImageModel} onValueChange={onImageModelChange}>
                    <SelectTrigger className="w-[120px] sm:w-[160px] h-7 sm:h-8 text-[10px] sm:text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-[10px] sm:text-xs">
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Show Edit Mode badge when images uploaded */}
              {selectedImages.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                  <span className="text-[10px] sm:text-xs font-medium text-primary">Edit Mode</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">({selectedImages.length} image{selectedImages.length > 1 ? 's' : ''})</span>
                </div>
              )}
              {/* Always show Vision Model selector */}
              {visionModels.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Vision Model:</span>
                  <Select value={effectiveVisionModel} onValueChange={onVisionModelChange}>
                    <SelectTrigger className="w-[140px] sm:w-[200px] h-7 sm:h-8 text-[10px] sm:text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visionModels.map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-[10px] sm:text-xs">
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Model Selectors for Agentic Video */}
          {activeTool === 'agentic_video' && (
            <div className="mb-2 flex flex-wrap items-center gap-3 px-1">
              {/* Show Image reference badge - required */}
              {selectedImages.length > 0 ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                  <span className="text-[10px] sm:text-xs font-medium text-primary">Image</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">({selectedImages.length} uploaded)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/20">
                  <span className="text-[10px] sm:text-xs font-medium text-destructive">Image Required</span>
                </div>
              )}
              {/* Resolution selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Resolution:</span>
                <Select value={selectedVideoResolution} onValueChange={onVideoResolutionChange}>
                  <SelectTrigger className="w-[100px] sm:w-[120px] h-7 sm:h-8 text-[10px] sm:text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_RESOLUTIONS.map((res) => (
                      <SelectItem key={res.id} value={res.id} className="text-[10px] sm:text-xs">
                        {res.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Vision Model selector - only show video-supporting models */}
              {(() => {
                const videoVisionModels = models.filter(m => supportsVideo(m))
                const effectiveVideoVisionModel = selectedVisionModel || (videoVisionModels.length > 0 ? videoVisionModels[0].id : '')
                return videoVisionModels.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Vision Model:</span>
                    <Select value={effectiveVideoVisionModel} onValueChange={onVisionModelChange}>
                      <SelectTrigger className="w-[140px] sm:w-[200px] h-7 sm:h-8 text-[10px] sm:text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {videoVisionModels.map((model) => (
                          <SelectItem key={model.id} value={model.id} className="text-[10px] sm:text-xs">
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Main Input Area - Mobile: stacked, Desktop: side by side */}
          <div className="flex flex-col gap-2">
            {/* Text Input Row */}
            <div className="flex items-end gap-1.5 sm:gap-2">
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
                className="h-12 w-12 sm:h-[64px] sm:w-[64px] shrink-0 rounded-lg border border-border/50 hover:bg-accent/50 disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

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
              <div className="flex-1 min-w-0 relative">
                <div className="relative border border-border/50 rounded-lg bg-background focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-colors">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onClick={handleTextareaClick}
                    placeholder={isRecording ? 'Recording...' : isProcessingOCR ? 'Extracting text...' : selectedImages.length > 0 ? `${selectedImages.length} image(s)` : 'Type message...'}
                    disabled={isInputDisabled}
                    className="min-h-[48px] sm:min-h-[64px] max-h-[120px] sm:max-h-[200px] resize-none border-0 bg-transparent px-3 sm:px-4 py-2.5 sm:py-3.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
                    rows={2}
                  />
                  {input.length > 0 && (
                    <div className="absolute bottom-1.5 right-2 sm:bottom-2 sm:right-3 text-[9px] sm:text-[10px] text-muted-foreground/60">
                      {input.length}
                    </div>
                  )}
                </div>

                {/* Tool Suggestions Popup - Mobile optimized */}
                {showToolSuggestions && filteredTools.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 sm:left-0 sm:right-auto mb-2 w-full sm:w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-muted/50 border-b border-border">
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Tools</p>
                    </div>
                    <div className="max-h-36 sm:max-h-48 overflow-y-auto">
                      {filteredTools.map((tool, index) => (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => insertToolMention(tool)}
                          className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 text-left transition-colors hover:bg-accent ${
                            index === selectedToolIndex ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium truncate">{tool.name}</p>
                            <p className="text-[9px] sm:text-xs text-muted-foreground truncate">{tool.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-muted/30 border-t border-border flex items-center justify-between">
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                        <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono">↑↓</kbd> to navigate
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                        <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono">Enter</kbd> to select
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Send Button */}
              {!isStreaming ? (
                <Button
                  type="submit"
                  disabled={disabled || (!input.trim() && selectedImages.length === 0) || isRecording || isTranscribing || isProcessingOCR}
                  className="h-12 w-12 sm:h-[64px] sm:w-[64px] shrink-0 rounded-lg border border-primary/50 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all p-0"
                >
                  <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onStop}
                  variant="destructive"
                  disabled={isRecording || isTranscribing}
                  className="h-12 w-12 sm:h-[64px] sm:w-[64px] shrink-0 rounded-lg border border-destructive/50 bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all p-0"
                >
                  <Square className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              )}
            </div>

            {/* Audio Visualizer - Full width on mobile */}
            {isRecording && audioData && (
              <div className="h-8 sm:h-10 rounded-lg bg-muted/30 border border-border/30 overflow-hidden">
                <AudioVisualizer
                  audioData={audioData}
                  isActive={isRecording}
                  barCount={24}
                />
              </div>
            )}

            {/* Helper Text - Stacked on mobile, horizontal on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-[9px] sm:text-[10px] text-muted-foreground px-0.5">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                <span className="whitespace-nowrap"><kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 font-mono text-[9px]">Enter</kbd> to send</span>
                <span className="text-muted-foreground/30 hidden sm:inline">|</span>
                <span className="whitespace-nowrap"><kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 font-mono text-[9px]">Shift+Enter</kbd> new line</span>
                {isRecording && (
                  <>
                    <span className="text-muted-foreground/30 hidden sm:inline">|</span>
                    <span className="text-destructive font-medium whitespace-nowrap">Recording...</span>
                  </>
                )}
                {isTranscribing && (
                  <>
                    <span className="text-muted-foreground/30 hidden sm:inline">|</span>
                    <span className="text-primary font-medium whitespace-nowrap">Transcribing...</span>
                  </>
                )}
                {isProcessingOCR && (
                  <>
                    <span className="text-muted-foreground/30 hidden sm:inline">|</span>
                    <span className="text-primary font-medium whitespace-nowrap">Processing OCR...</span>
                  </>
                )}
              </div>
              {disabled && !isRecording && !isTranscribing && !isProcessingOCR && (
                <div className="flex items-center gap-1.5 sm:justify-end">
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
