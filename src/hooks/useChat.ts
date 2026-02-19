import { useState, useEffect, useCallback, useRef } from 'react'
import { type Conversation, type Message, type Settings, type Model } from '@/types'
import {
  initializeStorage,
  loadConversations,
  saveConversation,
  deleteConversation as deleteConversationFromDB,
  getActiveConversationId,
  setActiveConversationId
} from '@/lib/chatStorage'
import { chatWithLLM, generateImage, editImage, generateVideo, type ChatMessage } from '@/lib/api'
import { agenticImageGeneration } from '@/lib/agenticImage'

export function useChat(settings: Settings, models: Model[] = []) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize storage and load conversations
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true)
        
        // Initialize IndexedDB and handle migration
        const { available, error } = await initializeStorage()
        
        if (!available) {
          setStorageError(error || 'Storage not available')
          setIsLoading(false)
          return
        }
        
        // Load conversations from IndexedDB
        const loaded = await loadConversations()
        
        // Get last active conversation
        const activeId = await getActiveConversationId()
        
        if (loaded.length === 0) {
          // Create first conversation
          const newConv: Conversation = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          setConversations([newConv])
          setCurrentConversationId(newConv.id)
          await saveConversation(newConv)
          await setActiveConversationId(newConv.id)
        } else {
          setConversations(loaded)
          // Restore active conversation or use first
          const convToActivate = activeId && loaded.find(c => c.id === activeId)
            ? activeId
            : loaded[0].id
          setCurrentConversationId(convToActivate)
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error)
        setStorageError('Failed to load conversations')
      } finally {
        setIsLoading(false)
      }
    }
    
    init()
  }, [])

  // Auto-save conversations when they change
  useEffect(() => {
    const saveAll = async () => {
      if (conversations.length === 0 || isLoading) return
      
      try {
        for (const conversation of conversations) {
          await saveConversation(conversation)
        }
      } catch (error) {
        console.error('Failed to save conversations:', error)
      }
    }
    
    saveAll()
  }, [conversations, isLoading])

  // Save active conversation ID when it changes
  useEffect(() => {
    if (currentConversationId) {
      setActiveConversationId(currentConversationId).catch(console.error)
    }
  }, [currentConversationId])

  const createNewConversation = useCallback(() => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setConversations(prev => [newConversation, ...prev])
    setCurrentConversationId(newConversation.id)
    return newConversation
  }, [])

  const currentConversation = conversations.find(c => c.id === currentConversationId)

  const sendMessage = useCallback(async (userMessage: string, images?: string[], activeTool?: string, visionModel?: string, imageModel?: string) => {
    let conversation = currentConversation

    if (!conversation) {
      conversation = createNewConversation()
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      images: images
    }

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: activeTool === 'create_image' ? 'Generating image...' : activeTool === 'edit_image' ? 'Editing image...' : activeTool === 'create_video' ? 'Generating video...' : activeTool === 'agentic_image' ? 'Starting agentic image generation...' : '',
      timestamp: Date.now(),
      model: activeTool === 'vision' ? (visionModel || settings.selectedModel) : settings.selectedModel,
      activeTool: activeTool,
      toolStatus: activeTool === 'create_image' || activeTool === 'vision' || activeTool === 'edit_image' || activeTool === 'create_video' || activeTool === 'agentic_image' ? 'pending' : undefined,
      generatedImages: [],
      generatedVideos: [],
      agenticIterations: activeTool === 'agentic_image' ? [] : undefined
    }

    setConversations(prev => prev.map(conv => {
      if (conv.id === conversation!.id) {
        const messages = [...conv.messages, userMsg, assistantMsg]
        const title = conv.messages.length === 0 ? userMessage.slice(0, 50) : conv.title
        return {
          ...conv,
          title,
          messages,
          updatedAt: Date.now()
        }
      }
      return conv
    }))

    setIsStreaming(true)
    abortControllerRef.current = new AbortController()

    try {
      // Handle image generation tool
      if (activeTool === 'create_image') {
        // Extract prompt by removing the @create_image mention
        const prompt = userMessage.replace(/@create_image\s*/gi, '').trim()
        
        if (!prompt) {
          throw new Error('Please provide a description for the image you want to generate.')
        }

        const generatedImage = await generateImage(prompt, settings.apiKey, settings.selectedImageModel)

        setConversations(prev => prev.map(conv => {
          if (conv.id === conversation!.id) {
            const msgs = [...conv.messages]
            const lastMsg = msgs[msgs.length - 1]
            lastMsg.content = `Generated image based on: "${prompt}"`
            lastMsg.generatedImages = [generatedImage]
            lastMsg.toolStatus = 'success'
            return { ...conv, messages: msgs }
          }
          return conv
        }))
      } else if (activeTool === 'agentic_image') {
        const prompt = userMessage.replace(/@agentic_image\s*/gi, '').trim()
        
        if (!prompt) {
          throw new Error('Please provide a description for the image you want to generate.')
        }

        const imageModelToUse = imageModel || settings.selectedImageModel
        const visionModelToUse = visionModel || settings.selectedVisionModel
        const initialImage = images && images.length > 0 ? images[0] : undefined

        const result = await agenticImageGeneration(
          prompt,
          settings.apiKey,
          imageModelToUse,
          visionModelToUse,
          3,
          initialImage,
          {
            onIterationStart: (iterationNumber, currentPrompt) => {
              setConversations(prev => prev.map(conv => {
                if (conv.id === conversation!.id) {
                  const msgs = [...conv.messages]
                  const lastMsg = msgs[msgs.length - 1]
                  lastMsg.content = `Iteration ${iterationNumber}: ${iterationNumber === 1 ? (initialImage ? 'Editing image...' : 'Generating initial image...') : `Editing image with: "${currentPrompt.slice(0, 50)}..."`}`
                  return { ...conv, messages: msgs }
                }
                return conv
              }))
            },
            onImageGenerated: (iterationNumber, image) => {
              setConversations(prev => prev.map(conv => {
                if (conv.id === conversation!.id) {
                  const msgs = [...conv.messages]
                  const lastMsg = msgs[msgs.length - 1]
                  lastMsg.content = `Iteration ${iterationNumber}: Verifying with vision model...`
                  // Only show current iteration's image, not accumulated history
                  lastMsg.generatedImages = [image]
                  return { ...conv, messages: msgs }
                }
                return conv
              }))
            },
            onVisionCheck: (iterationNumber, feedback) => {
              setConversations(prev => prev.map(conv => {
                if (conv.id === conversation!.id) {
                  const msgs = [...conv.messages]
                  const lastMsg = msgs[msgs.length - 1]
                  
                  if (lastMsg.agenticIterations) {
                    // Check if iteration already exists, update it instead of adding duplicate
                    const existingIndex = lastMsg.agenticIterations.findIndex(
                      iter => iter.iterationNumber === iterationNumber
                    )
                    
                    const iterationData = {
                      iterationNumber,
                      image: lastMsg.generatedImages?.[0] || '',
                      editPrompt: '',
                      visionFeedback: feedback
                    }
                    
                    if (existingIndex >= 0) {
                      // Update existing iteration
                      lastMsg.agenticIterations[existingIndex] = iterationData
                    } else {
                      // Add new iteration
                      lastMsg.agenticIterations.push(iterationData)
                    }
                  }
                  
                  if (feedback.satisfied) {
                    lastMsg.content = `✓ Image satisfied requirements after ${iterationNumber} iteration${iterationNumber > 1 ? 's' : ''}`
                  } else {
                    lastMsg.content = `Iteration ${iterationNumber}: Issues found - ${feedback.issues.slice(0, 2).join(', ')}${feedback.issues.length > 2 ? '...' : ''}`
                  }
                  return { ...conv, messages: msgs }
                }
                return conv
              }))
            }
          }
        )

        // Final update with all iterations
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversation!.id) {
            const msgs = [...conv.messages]
            const lastMsg = msgs[msgs.length - 1]
            lastMsg.content = result.success 
              ? `✓ Generated image with ${result.totalIterations} iteration${result.totalIterations > 1 ? 's' : ''}: "${prompt}"`
              : `⚠ Max iterations reached. Best result after ${result.totalIterations} iterations: "${prompt}"`
            lastMsg.generatedImages = [result.finalImage]
            lastMsg.agenticIterations = result.iterations
            lastMsg.toolStatus = result.success ? 'success' : 'error'
            return { ...conv, messages: msgs }
          }
          return conv
        }))
      } else if (activeTool === 'vision') {
        // Vision tool - send images to LLM
        const modelToUse = visionModel || settings.selectedModel
        
        // Prepare messages with images for vision model
        const messages: ChatMessage[] = [
          ...(settings.instructions ? [{ role: 'system', content: settings.instructions }] : []),
          ...conversation.messages.map((msg): ChatMessage => {
            // Only send text content, ignore images for API
            return {
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : ''
            }
          }),
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userMessage.replace(/@vision\s*/gi, '').trim() || 'Analyze this image'
              },
              ...(images || []).map(img => ({
                type: 'image_url' as const,
                image_url: { url: img }
              }))
            ]
          }
        ]

        let accumulatedContent = ''

        // Get max_tokens for the vision model
        const selectedModel = models.find(m => m.id === modelToUse)
        const max_tokens = selectedModel?.max_tokens

        await chatWithLLM(
          messages,
          settings.apiKey,
          modelToUse,
          (content) => {
            accumulatedContent += content
            setConversations(prev => prev.map(conv => {
              if (conv.id === conversation!.id) {
                const msgs = [...conv.messages]
                const lastMsg = msgs[msgs.length - 1]
                lastMsg.content = accumulatedContent
                return { ...conv, messages: msgs }
              }
              return conv
            }))
          },
          abortControllerRef.current.signal,
          max_tokens
        )

        // Mark as success after completion
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversation!.id) {
            const msgs = [...conv.messages]
            const lastMsg = msgs[msgs.length - 1]
            lastMsg.toolStatus = 'success'
            return { ...conv, messages: msgs }
          }
          return conv
        }))
      } else if (activeTool === 'edit_image') {
        // Extract prompt by removing the @edit_image mention
        const prompt = userMessage.replace(/@edit_image\s*/gi, '').trim()
        
        if (!prompt) {
          throw new Error('Please provide a description for how to edit the image.')
        }

        if (!images || images.length === 0) {
          throw new Error('Please upload at least one image to edit.')
        }

        const editedImage = await editImage(prompt, images, settings.apiKey)

        setConversations(prev => prev.map(conv => {
          if (conv.id === conversation!.id) {
            const msgs = [...conv.messages]
            const lastMsg = msgs[msgs.length - 1]
            lastMsg.content = `Edited image based on: "${prompt}"`
            lastMsg.generatedImages = [editedImage]
            lastMsg.toolStatus = 'success'
            return { ...conv, messages: msgs }
          }
          return conv
        }))
      } else if (activeTool === 'create_video') {
        // Extract prompt by removing the @create_video mention
        const prompt = userMessage.replace(/@create_video\s*/gi, '').trim()
        
        if (!prompt) {
          throw new Error('Please provide a description for the video you want to generate.')
        }

        // Get the first image if provided (optional for video generation)
        const image = images && images.length > 0 ? images[0] : undefined

        const generatedVideo = await generateVideo(prompt, settings.apiKey, image, settings.selectedVideoResolution)

        setConversations(prev => prev.map(conv => {
          if (conv.id === conversation!.id) {
            const msgs = [...conv.messages]
            const lastMsg = msgs[msgs.length - 1]
            lastMsg.content = image 
              ? `Generated video based on image and prompt: "${prompt}"`
              : `Generated video based on: "${prompt}"`
            lastMsg.generatedVideos = [generatedVideo]
            lastMsg.toolStatus = 'success'
            return { ...conv, messages: msgs }
          }
          return conv
        }))
      } else {
        // Normal LLM chat flow
        // Only send text to LLM - images are for UI display only
        // OCR text is already included in userMessage by ChatInput
        const messages: ChatMessage[] = [
          ...(settings.instructions ? [{ role: 'system', content: settings.instructions }] : []),
          ...conversation.messages.map((msg): ChatMessage => {
            // Only send text content, ignore images for API
            return {
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : ''
            }
          }),
          {
            role: 'user',
            content: userMessage
          }
        ]

        let accumulatedContent = ''

        // Get max_tokens for the selected model
        const selectedModel = models.find(m => m.id === settings.selectedModel)
        const max_tokens = selectedModel?.max_tokens

        await chatWithLLM(
          messages,
          settings.apiKey,
          settings.selectedModel,
          (content) => {
            accumulatedContent += content
            setConversations(prev => prev.map(conv => {
              if (conv.id === conversation!.id) {
                const msgs = [...conv.messages]
                const lastMsg = msgs[msgs.length - 1]
                lastMsg.content = accumulatedContent
                return { ...conv, messages: msgs }
              }
              return conv
            }))
          },
          abortControllerRef.current.signal,
          max_tokens
        )
      }
    } catch (error) {
      console.error('Chat error:', error)
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversation!.id) {
          const messages = [...conv.messages]
          const lastMsg = messages[messages.length - 1]
          lastMsg.content = error instanceof Error ? error.message : 'Failed to get response'
          lastMsg.toolStatus = 'error'
          return { ...conv, messages }
        }
        return conv
      }))
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [currentConversation, settings, createNewConversation, models])

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversationFromDB(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (currentConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id)
        if (remaining.length > 0) {
          setCurrentConversationId(remaining[0].id)
        } else {
          createNewConversation()
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }, [conversations, currentConversationId, createNewConversation])

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === id) {
        return { ...conv, title: newTitle }
      }
      return conv
    }))
  }, [])

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
  }, [])

  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id)
  }, [])

  return {
    conversations,
    currentConversation,
    currentConversationId,
    isStreaming,
    isLoading,
    storageError,
    createNewConversation,
    sendMessage,
    deleteConversation,
    renameConversation,
    stopStreaming,
    selectConversation
  }
}
