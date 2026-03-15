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
import { agenticVideoGeneration } from '@/lib/agenticVideo'
import { RPGGameEngine, type RPGGameState } from '@/lib/rpg'

export function useChat(settings: Settings, models: Model[] = []) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [rpgEngine, setRpgEngine] = useState<RPGGameEngine | null>(null)
  const [isProcessingRPG, setIsProcessingRPG] = useState(false)
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
          const convToActivate =
            activeId && loaded.find(c => c.id === activeId) ? activeId : loaded[0].id
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

  const sendMessage = useCallback(
    async (
      userMessage: string,
      images?: string[],
      activeTool?: string,
      visionModel?: string,
      imageModel?: string,
      videoResolution?: string,
      maxAgenticIterations?: number
    ) => {
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
        content:
          activeTool === 'create_image'
            ? 'Generating image...'
            : activeTool === 'edit_image'
              ? 'Editing image...'
              : activeTool === 'create_video'
                ? 'Generating video...'
                : activeTool === 'agentic_image'
                  ? 'Starting agentic image generation...'
                  : activeTool === 'agentic_video'
                    ? 'Starting agentic video generation...'
                    : '',
        timestamp: Date.now(),
        model:
          activeTool === 'vision' ? visionModel || settings.selectedModel : settings.selectedModel,
        activeTool: activeTool,
        toolStatus:
          activeTool === 'create_image' ||
          activeTool === 'vision' ||
          activeTool === 'edit_image' ||
          activeTool === 'create_video' ||
          activeTool === 'agentic_image' ||
          activeTool === 'agentic_video' ||
          activeTool === 'rpg'
            ? 'pending'
            : undefined,
        generatedImages: [],
        generatedVideos: [],
        agenticIterations: activeTool === 'agentic_image' ? [] : undefined,
        agenticVideoIterations: activeTool === 'agentic_video' ? [] : undefined
      }

      setConversations(prev =>
        prev.map(conv => {
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
        })
      )

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

          const generatedImage = await generateImage(
            prompt,
            settings.apiKey,
            settings.selectedImageModel
          )

          setConversations(prev =>
            prev.map(conv => {
              if (conv.id === conversation!.id) {
                const msgs = [...conv.messages]
                const lastMsg = msgs[msgs.length - 1]
                lastMsg.content = `Generated image based on: "${prompt}"`
                lastMsg.generatedImages = [generatedImage]
                lastMsg.toolStatus = 'success'
                return { ...conv, messages: msgs }
              }
              return conv
            })
          )
        } else if (activeTool === 'agentic_image') {
          const prompt = userMessage.replace(/@agentic_image\s*/gi, '').trim()

          if (!prompt) {
            throw new Error('Please provide a description for the image you want to generate.')
          }

          const imageModelToUse = imageModel || settings.selectedImageModel
          const visionModelToUse = visionModel || settings.selectedVisionModel
          const initialImages = images && images.length > 0 ? images : undefined

          const result = await agenticImageGeneration(
            prompt,
            settings.apiKey,
            imageModelToUse,
            visionModelToUse,
            maxAgenticIterations || settings.maxAgenticIterations || 3,
            initialImages,
            settings.selectedModel,
            {
              onAnalysisStart: () => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      lastMsg.content =
                        '🔍 Analyzing images to detect faces, clothing, and objects...'
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              },
              onAnalysisComplete: analysis => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      const faceCount = analysis.faces.length
                      const clothingCount = analysis.clothing.length
                      lastMsg.imageAnalysis = analysis
                      lastMsg.content = `📊 Analysis complete: Detected ${faceCount} face${faceCount !== 1 ? 's' : ''}, ${clothingCount} clothing item${clothingCount !== 1 ? 's' : ''}`
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              },
              onIterationStart: (iterationNumber, currentPrompt, isEditing) => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      lastMsg.content = `Iteration ${iterationNumber}: ${iterationNumber === 1 ? (isEditing ? 'Editing image...' : 'Generating initial image...') : `Editing image with: "${currentPrompt.slice(0, 50)}..."`}`
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              },
              onImageGenerated: (iterationNumber, image) => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      lastMsg.content = `Iteration ${iterationNumber}: Verifying with vision model...`
                      // Only show current iteration's image, not accumulated history
                      lastMsg.generatedImages = [image]
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              },
              onVisionCheck: (iterationNumber, feedback) => {
                setConversations(prev =>
                  prev.map(conv => {
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
                  })
                )
              },
              onPlanningStart: iterationNumber => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      if (iterationNumber === 0) {
                        lastMsg.content = '🧠 Planning optimized edit prompt...'
                      } else {
                        lastMsg.content = `Iteration ${iterationNumber}: 🧠 Planning optimized edit prompt...`
                      }
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              },
              onPlanningComplete: (iterationNumber, plannedPrompt) => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      if (iterationNumber === 0) {
                        lastMsg.content = `📝 Planned: "${plannedPrompt.slice(0, 80)}${plannedPrompt.length > 80 ? '...' : ''}"`
                      } else {
                        lastMsg.content = `Iteration ${iterationNumber}: 📝 Planned: "${plannedPrompt.slice(0, 60)}..."`
                      }
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              }
            }
          )

          // Final update with all iterations
          setConversations(prev =>
            prev.map(conv => {
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
            })
          )
        } else if (activeTool === 'agentic_video') {
          const prompt = userMessage.replace(/@agentic_video\s*/gi, '').trim()

          if (!prompt) {
            throw new Error('Please provide a description for the video you want to generate.')
          }

          const resolutionToUse = videoResolution || settings.selectedVideoResolution
          const visionModelToUse = visionModel || settings.selectedVisionModel
          const initialImage = images && images.length > 0 ? images[0] : undefined

          if (!initialImage) {
            throw new Error('Please attach an image to generate a video from.')
          }

          const result = await agenticVideoGeneration(
            prompt,
            settings.apiKey,
            resolutionToUse,
            visionModelToUse,
            maxAgenticIterations || settings.maxAgenticIterations || 3,
            initialImage,
            {
              onIterationStart: (iterationNumber, currentPrompt) => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      lastMsg.content = `Iteration ${iterationNumber}: ${iterationNumber === 1 ? (initialImage ? 'Generating video from image...' : 'Generating initial video...') : `Regenerating video with: "${currentPrompt.slice(0, 50)}..."`}`
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              },
              onVideoGenerated: (iterationNumber, video) => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]
                      lastMsg.content = `Iteration ${iterationNumber}: Verifying with vision model...`
                      lastMsg.generatedVideos = [video]
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              },
              onVisionCheck: (iterationNumber, feedback) => {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.id === conversation!.id) {
                      const msgs = [...conv.messages]
                      const lastMsg = msgs[msgs.length - 1]

                      if (lastMsg.agenticVideoIterations) {
                        const existingIndex = lastMsg.agenticVideoIterations.findIndex(
                          iter => iter.iterationNumber === iterationNumber
                        )

                        const iterationData = {
                          iterationNumber,
                          video: lastMsg.generatedVideos?.[0] || '',
                          editPrompt: '',
                          visionFeedback: feedback
                        }

                        if (existingIndex >= 0) {
                          lastMsg.agenticVideoIterations[existingIndex] = iterationData
                        } else {
                          lastMsg.agenticVideoIterations.push(iterationData)
                        }
                      }

                      if (feedback.satisfied) {
                        lastMsg.content = `✓ Video satisfied requirements after ${iterationNumber} iteration${iterationNumber > 1 ? 's' : ''}`
                      } else {
                        lastMsg.content = `Iteration ${iterationNumber}: Issues found - ${feedback.issues.slice(0, 2).join(', ')}${feedback.issues.length > 2 ? '...' : ''}`
                      }
                      return { ...conv, messages: msgs }
                    }
                    return conv
                  })
                )
              }
            }
          )

          // Final update with all iterations
          setConversations(prev =>
            prev.map(conv => {
              if (conv.id === conversation!.id) {
                const msgs = [...conv.messages]
                const lastMsg = msgs[msgs.length - 1]
                lastMsg.content = result.success
                  ? `✓ Generated video with ${result.totalIterations} iteration${result.totalIterations > 1 ? 's' : ''}: "${prompt}"`
                  : `⚠ Max iterations reached. Best result after ${result.totalIterations} iterations: "${prompt}"`
                lastMsg.generatedVideos = [result.finalVideo]
                lastMsg.agenticVideoIterations = result.iterations
                lastMsg.toolStatus = result.success ? 'success' : 'error'
                return { ...conv, messages: msgs }
              }
              return conv
            })
          )
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
            content => {
              accumulatedContent += content
              setConversations(prev =>
                prev.map(conv => {
                  if (conv.id === conversation!.id) {
                    const msgs = [...conv.messages]
                    const lastMsg = msgs[msgs.length - 1]
                    lastMsg.content = accumulatedContent
                    return { ...conv, messages: msgs }
                  }
                  return conv
                })
              )
            },
            abortControllerRef.current.signal,
            max_tokens
          )

          // Mark as success after completion
          setConversations(prev =>
            prev.map(conv => {
              if (conv.id === conversation!.id) {
                const msgs = [...conv.messages]
                const lastMsg = msgs[msgs.length - 1]
                lastMsg.toolStatus = 'success'
                return { ...conv, messages: msgs }
              }
              return conv
            })
          )
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

          setConversations(prev =>
            prev.map(conv => {
              if (conv.id === conversation!.id) {
                const msgs = [...conv.messages]
                const lastMsg = msgs[msgs.length - 1]
                lastMsg.content = `Edited image based on: "${prompt}"`
                lastMsg.generatedImages = [editedImage]
                lastMsg.toolStatus = 'success'
                return { ...conv, messages: msgs }
              }
              return conv
            })
          )
        } else if (activeTool === 'create_video') {
          // Extract prompt by removing the @create_video mention
          const prompt = userMessage.replace(/@create_video\s*/gi, '').trim()

          if (!prompt) {
            throw new Error('Please provide a description for the video you want to generate.')
          }

          // Get the first image if provided (optional for video generation)
          const image = images && images.length > 0 ? images[0] : undefined

          const generatedVideo = await generateVideo(
            prompt,
            settings.apiKey,
            image,
            settings.selectedVideoResolution
          )

          setConversations(prev =>
            prev.map(conv => {
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
            })
          )
        } else if (activeTool === 'rpg') {
          // RPG Game mode - Initialize game with agents using selected model
          const topic = userMessage.replace(/@rpg\s*/gi, '').trim()

          if (!topic) {
            throw new Error(
              'Please provide a topic for the RPG game. E.g., @rpg Create a fantasy world'
            )
          }

          // Import agent templates and set selected model
          const { RPG_AGENT_TEMPLATES } = await import('@/types/rpg')
          const selectedModel = settings.selectedModel || 'unsloth/gemma-3-27b-it'
          console.log('RPG using model:', selectedModel)
          const agents = RPG_AGENT_TEMPLATES.slice(0, 3).map(agent => ({
            ...agent,
            model: selectedModel
          }))

          // Initialize game state
          const initialGameState: RPGGameState = {
            gameId: `rpg-${Date.now()}`,
            topic,
            round: 0,
            status: 'active',
            context: {
              story: '',
              elements: [],
              decisions: []
            },
            settings: {
              chaosEventsEnabled: true,
              chaosEventProbability: 0.2
            }
          }

          setConversations(prev =>
            prev.map(conv => {
              if (conv.id === conversation!.id) {
                const msgs = [...conv.messages]
                const lastMsg = msgs[msgs.length - 1]
                lastMsg.rpgState = initialGameState
                lastMsg.rpgAgents = agents
                lastMsg.content = `🎮 RPG Session Started: ${topic}\n\nRound 0 - Select agents and provide your first direction!`
                lastMsg.toolStatus = 'success'
                return { ...conv, messages: msgs }
              }
              return conv
            })
          )
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
            content => {
              accumulatedContent += content
              setConversations(prev =>
                prev.map(conv => {
                  if (conv.id === conversation!.id) {
                    const msgs = [...conv.messages]
                    const lastMsg = msgs[msgs.length - 1]
                    lastMsg.content = accumulatedContent
                    return { ...conv, messages: msgs }
                  }
                  return conv
                })
              )
            },
            abortControllerRef.current.signal,
            max_tokens
          )
        }
      } catch (error) {
        console.error('Chat error:', error)
        setConversations(prev =>
          prev.map(conv => {
            if (conv.id === conversation!.id) {
              const messages = [...conv.messages]
              const lastMsg = messages[messages.length - 1]
              lastMsg.content = error instanceof Error ? error.message : 'Failed to get response'
              lastMsg.toolStatus = 'error'
              return { ...conv, messages }
            }
            return conv
          })
        )
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [currentConversation, settings, createNewConversation, models]
  )

  const deleteConversation = useCallback(
    async (id: string) => {
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
    },
    [conversations, currentConversationId, createNewConversation]
  )

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === id) {
          return { ...conv, title: newTitle }
        }
        return conv
      })
    )
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

  // RPG Game functions
  const startRPGRound = useCallback(
    async (conversationId: string, prompt: string) => {
      const conversation = conversations.find(c => c.id === conversationId)
      if (!conversation) return

      const lastMessage = conversation.messages[conversation.messages.length - 1]
      if (!lastMessage.rpgState || !lastMessage.rpgAgents) return

      console.log(
        'RPG agents model:',
        lastMessage.rpgAgents.map(a => a.model)
      )

      setIsProcessingRPG(true)

      // Create or use existing engine - always use latest agents from message
      let engine = rpgEngine
      if (!engine) {
        engine = new RPGGameEngine(
          lastMessage.rpgState.topic,
          lastMessage.rpgAgents,
          settings.apiKey,
          {
            onRoundStart: round => {
              console.log('Round started:', round)
            },
            onChaosEventTriggered: event => {
              setConversations(prev =>
                prev.map(conv => {
                  if (conv.id === conversationId) {
                    const msgs = [...conv.messages]
                    const lastMsg = msgs[msgs.length - 1]
                    if (lastMsg.rpgRound) {
                      lastMsg.rpgRound.chaosEvent = event
                    }
                    return { ...conv, messages: msgs }
                  }
                  return conv
                })
              )
            },
            onAgentTurnStart: agent => {
              setConversations(prev =>
                prev.map(conv => {
                  if (conv.id === conversationId) {
                    const msgs = [...conv.messages]
                    const lastMsg = msgs[msgs.length - 1]
                    if (lastMsg.rpgRound) {
                      lastMsg.content = `${agent.name} is thinking...`
                    }
                    return { ...conv, messages: msgs }
                  }
                  return conv
                })
              )
            },
            onAgentChunk: (agent, chunk) => {
              setConversations(prev =>
                prev.map(conv => {
                  if (conv.id === conversationId) {
                    const msgs = [...conv.messages]
                    const lastMsg = msgs[msgs.length - 1]
                    if (lastMsg.rpgRound && lastMsg.rpgRound.agentTurns.length > 0) {
                      const lastTurn =
                        lastMsg.rpgRound.agentTurns[lastMsg.rpgRound.agentTurns.length - 1]
                      if (lastTurn.agentId === agent.id) {
                        lastTurn.response += chunk
                        lastTurn.contribution =
                          lastTurn.response
                            .match(/CONTRIBUTION:\s*(.+?)(?=THINKING:|$)/s)?.[1]
                            ?.trim() || lastTurn.response
                      }
                    }
                    return { ...conv, messages: msgs }
                  }
                  return conv
                })
              )
            },
            onAgentTurnComplete: (agent, response) => {
              setConversations(prev =>
                prev.map(conv => {
                  if (conv.id === conversationId) {
                    const msgs = [...conv.messages]
                    const lastMsg = msgs[msgs.length - 1]
                    if (lastMsg.rpgRound) {
                      const existingTurn = lastMsg.rpgRound.agentTurns.find(
                        t => t.agentId === agent.id
                      )
                      if (!existingTurn) {
                        lastMsg.rpgRound.agentTurns.push({
                          agentId: agent.id,
                          agentName: agent.customName || agent.name,
                          prompt: '',
                          response,
                          contribution:
                            response.match(/CONTRIBUTION:\s*(.+?)(?=THINKING:|$)/s)?.[1]?.trim() ||
                            response,
                          timestamp: Date.now()
                        })
                      }
                    }
                    return { ...conv, messages: msgs }
                  }
                  return conv
                })
              )
            },
            onRoundComplete: round => {
              setConversations(prev =>
                prev.map(conv => {
                  if (conv.id === conversationId) {
                    const msgs = [...conv.messages]
                    const lastMsg = msgs[msgs.length - 1]
                    if (lastMsg.rpgState) {
                      lastMsg.rpgState.round = round.roundNumber
                      lastMsg.rpgRound = round
                      lastMsg.content = `Round ${round.roundNumber} complete! ${round.agentTurns.length} agents contributed.`
                    }
                    return { ...conv, messages: msgs }
                  }
                  return conv
                })
              )
              setIsProcessingRPG(false)
            }
          },
          lastMessage.rpgState.settings
        )
        setRpgEngine(engine)
      }

      // Restore game state and ensure agents have correct model
      engine['state'] = lastMessage.rpgState
      engine['agents'] = lastMessage.rpgAgents

      try {
        await engine.startRound(prompt)
      } catch (error) {
        console.error('RPG round error:', error)
        setIsProcessingRPG(false)
      }
    },
    [conversations, rpgEngine, settings.apiKey]
  )

  const toggleRPGChaos = useCallback((conversationId: string, enabled: boolean) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          const msgs = [...conv.messages]
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg.rpgState) {
            lastMsg.rpgState.settings.chaosEventsEnabled = enabled
          }
          return { ...conv, messages: msgs }
        }
        return conv
      })
    )
  }, [])

  const stopRPG = useCallback(() => {
    if (rpgEngine) {
      rpgEngine.stop()
    }
    setIsProcessingRPG(false)
  }, [rpgEngine])

  const completeRPG = useCallback((conversationId: string) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          const msgs = [...conv.messages]
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg.rpgState) {
            lastMsg.rpgState.status = 'completed'
            lastMsg.content = `🎮 RPG Session Complete!\n\n${lastMsg.rpgState.context.story || 'Session ended.'}`
          }
          return { ...conv, messages: msgs }
        }
        return conv
      })
    )
    setRpgEngine(null)
    setIsProcessingRPG(false)
  }, [])

  return {
    conversations,
    currentConversation,
    currentConversationId,
    isStreaming,
    isLoading,
    storageError,
    isProcessingRPG,
    createNewConversation,
    sendMessage,
    deleteConversation,
    renameConversation,
    stopStreaming,
    selectConversation,
    startRPGRound,
    toggleRPGChaos,
    stopRPG,
    completeRPG
  }
}
