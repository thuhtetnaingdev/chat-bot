import { useState, type KeyboardEvent, type FormEvent, useRef, useEffect, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Square, ArrowUp, Paperclip, X, ImageIcon } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer'
import { AudioVisualizer } from '@/components/AudioVisualizer'
import { VoiceInputButton } from '@/components/VoiceInputButton'
import { transcribeAudio, processImageFile, performOCR } from '@/lib/api'
import { availableTools, type Tool } from '@/types'

export interface ChatInputProps {
  onSend: (message: string, images?: string[], activeTool?: string) => Promise<void>
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  apiKey?: string
  isThinking: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, apiKey = '' }: ChatInputProps) {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if ((input.trim() || selectedImages.length > 0) && !isStreaming && !disabled && !isTranscribing && !isProcessingOCR) {
      const activeTool = getActiveTool()
      
      // If there are images, process OCR in background first
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

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        
        const base64 = await processImageFile(file)
        images.push(base64)
      }
      
      setSelectedImages(prev => [...prev, ...images])
    } catch (error) {
      console.error('File processing error:', error)
      setTranscriptionError('Failed to process image')
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

  const isInputDisabled = disabled || isStreaming || isTranscribing || isRecording || isProcessingOCR

  return (
    <div className="border-t border-border/50 bg-card/30">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit}>
          {/* Error Message */}
          {(transcriptionError || recordingError) && (
            <div className="mb-3 flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">
                {transcriptionError || recordingError}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearError}
                className="h-7 text-xs hover:bg-destructive/20"
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
                    className="h-16 w-16 object-cover rounded-lg border border-border/50"
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

          {/* Main Input Row */}
          <div className="flex items-end gap-2">
            {/* File Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleFileButtonClick}
              disabled={disabled || isStreaming || isRecording || isTranscribing || !apiKey}
              className="h-[64px] w-[64px] shrink-0 rounded-lg border border-border/50 hover:bg-accent/50 disabled:opacity-50"
            >
              <Paperclip className="h-5 w-5" />
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
                  placeholder={isRecording ? 'Recording...' : isProcessingOCR ? 'Extracting text from images...' : selectedImages.length > 0 ? `${selectedImages.length} image(s) attached` : 'Type your message...'}
                  disabled={isInputDisabled}
                  className="min-h-[64px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
                  rows={2}
                />
                {input.length > 0 && (
                  <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60">
                    {input.length}
                  </div>
                )}
              </div>

              {/* Tool Suggestions Popup */}
              {showToolSuggestions && filteredTools.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="px-3 py-2 bg-muted/50 border-b border-border">
                    <p className="text-xs text-muted-foreground font-medium">Tools</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredTools.map((tool, index) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => insertToolMention(tool)}
                        className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors hover:bg-accent ${
                          index === selectedToolIndex ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <ImageIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tool.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-muted/30 border-t border-border flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                      <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono">↑↓</kbd> to navigate
                    </p>
                    <p className="text-[10px] text-muted-foreground">
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
                className="h-[64px] w-[64px] shrink-0 rounded-lg border border-primary/50 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all p-0"
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onStop}
                variant="destructive"
                disabled={isRecording || isTranscribing}
                className="h-[64px] w-[64px] shrink-0 rounded-lg border border-destructive/50 bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all p-0"
              >
                <Square className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Audio Visualizer */}
          {isRecording && audioData && (
            <div className="mt-3 h-10 rounded-lg bg-muted/30 border border-border/30 overflow-hidden">
              <AudioVisualizer
                audioData={audioData}
                isActive={isRecording}
                barCount={32}
              />
            </div>
          )}

          {/* Helper Text */}
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono">Enter</kbd> to send</span>
              <span className="text-muted-foreground/30">|</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono">Shift + Enter</kbd> for new line</span>
              {isRecording && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="text-destructive font-medium">Recording...</span>
                </>
              )}
              {isTranscribing && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="text-primary font-medium">Transcribing...</span>
                </>
              )}
              {isProcessingOCR && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="text-primary font-medium">Processing OCR...</span>
                </>
              )}
            </div>
            {disabled && !isRecording && !isTranscribing && !isProcessingOCR && (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                <span>API key required</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
