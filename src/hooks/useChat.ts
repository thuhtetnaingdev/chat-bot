import { useState, useEffect, useCallback, useRef } from 'react'
import { type Conversation, type Message, type Settings } from '@/types'
import { loadConversations, saveConversations } from '@/lib/storage'
import { chatWithLLM, generateImage, type ChatMessage } from '@/lib/api'

export function useChat(settings: Settings) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

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

  useEffect(() => {
    const loaded = loadConversations()
    if (loaded.length === 0) {
      const newConv = createNewConversation()
      setCurrentConversationId(newConv.id)
    } else {
      setConversations(loaded)
      setCurrentConversationId(loaded[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations)
    }
  }, [conversations])

  const currentConversation = conversations.find(c => c.id === currentConversationId)

  const sendMessage = useCallback(async (userMessage: string, images?: string[], activeTool?: string) => {
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
      content: activeTool === 'create_image' ? 'Generating image...' : '',
      timestamp: Date.now(),
      model: settings.selectedModel,
      activeTool: activeTool,
      toolStatus: activeTool === 'create_image' ? 'pending' : undefined,
      generatedImages: []
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
          abortControllerRef.current.signal
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
  }, [currentConversation, settings, createNewConversation])

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    if (currentConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id)
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id)
      } else {
        createNewConversation()
      }
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
    createNewConversation,
    sendMessage,
    deleteConversation,
    renameConversation,
    stopStreaming,
    selectConversation
  }
}
