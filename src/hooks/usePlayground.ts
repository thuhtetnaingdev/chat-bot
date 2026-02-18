import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type PlaygroundSession,
  type PromptVariant,
  type TestRun,
  type PromptVariable,
  type RunMetrics,
  type SessionType,
  MAX_VARIANTS,
  detectVariables,
  mergeVariables,
  interpolatePrompt,
  estimateTokens,
  generateSessionName,
  generateVariantName,
  getBestRun
} from '@/types/playground'
import {
  saveSession,
  loadAllSessions,
  deleteSession as deleteSessionFromStorage,
  getActiveSessionId,
  setActiveSessionId
} from '@/lib/playgroundStorage'
import { chatWithLLM, generateImage, editImage, type ChatMessage } from '@/lib/api'
import { type Model } from '@/types'

export function usePlayground(
  apiKey: string,
  selectedModel: string,
  models: Model[],
  selectedImageModel: string
) {
  const [sessions, setSessions] = useState<PlaygroundSession[]>([])
  const [activeSession, setActiveSession] = useState<PlaygroundSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [runningVariantIds, setRunningVariantIds] = useState<string[]>([])
  const [streamingOutput, setStreamingOutput] = useState<Record<string, string>>({})

  const autoSaveRef = useRef(activeSession)

  useEffect(() => {
    autoSaveRef.current = activeSession
  }, [activeSession])

  const autoSave = useCallback(async (session: PlaygroundSession) => {
    try {
      await saveSession(session)
    } catch (error) {
      console.error('Failed to auto-save session:', error)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const allSessions = await loadAllSessions()
        setSessions(allSessions)

        const activeId = await getActiveSessionId()
        if (activeId) {
          const session = allSessions.find(s => s.id === activeId)
          if (session) {
            setActiveSession(session)
          } else if (allSessions.length > 0) {
            setActiveSession(allSessions[0])
            await setActiveSessionId(allSessions[0].id)
          }
        } else if (allSessions.length > 0) {
          setActiveSession(allSessions[0])
          await setActiveSessionId(allSessions[0].id)
        }
      } catch (error) {
        console.error('Failed to initialize playground:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  useEffect(() => {
    if (!isLoading && activeSession) {
      const timer = setTimeout(() => {
        autoSave(activeSession)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [activeSession, isLoading, autoSave])

  const createNewSession = useCallback(async () => {
    const newSession: PlaygroundSession = {
      id: crypto.randomUUID(),
      name: generateSessionName(sessions),
      type: 'text',
      variants: [],
      testCases: [],
      variables: [],
      runs: [],
      testInput: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    await saveSession(newSession)
    await setActiveSessionId(newSession.id)
    setSessions(prev => [newSession, ...prev])
    setActiveSession(newSession)
    
    return newSession
  }, [sessions])

  const selectSession = useCallback(async (id: string) => {
    const session = sessions.find(s => s.id === id)
    if (session) {
      await setActiveSessionId(id)
      setActiveSession(session)
    }
  }, [sessions])

  const deleteSessionById = useCallback(async (id: string) => {
    await deleteSessionFromStorage(id)
    setSessions(prev => prev.filter(s => s.id !== id))

    if (activeSession?.id === id) {
      const remaining = sessions.filter(s => s.id !== id)
      if (remaining.length > 0) {
        await setActiveSessionId(remaining[0].id)
        setActiveSession(remaining[0])
      } else {
        await setActiveSessionId(null)
        setActiveSession(null)
      }
    }
  }, [sessions, activeSession])

  const updateActiveSession = useCallback((updates: Partial<PlaygroundSession>) => {
    setActiveSession(prev => {
      if (!prev) return null
      return {
        ...prev,
        ...updates,
        updatedAt: Date.now()
      }
    })
  }, [])

  const addVariant = useCallback(() => {
    if (!activeSession || activeSession.variants.length >= MAX_VARIANTS) {
      return null
    }

    const newVariant: PromptVariant = {
      id: crypto.randomUUID(),
      name: generateVariantName(activeSession.variants),
      prompt: '',
      imageModel: selectedImageModel,
      createdAt: Date.now()
    }

    updateActiveSession({
      variants: [...activeSession.variants, newVariant]
    })

    return newVariant
  }, [activeSession, updateActiveSession, selectedImageModel])

  const updateVariant = useCallback((id: string, updates: Partial<PromptVariant>) => {
    if (!activeSession) return

    const variants = activeSession.variants.map(v => 
      v.id === id ? { ...v, ...updates } : v
    )

    const allDetectedVariables: PromptVariable[] = []
    for (const variant of variants) {
      const detected = detectVariables(variant.prompt)
      for (const v of detected) {
        if (!allDetectedVariables.find(av => av.name === v.name)) {
          allDetectedVariables.push(v)
        }
      }
    }

    const mergedVariables = mergeVariables(activeSession.variables, allDetectedVariables)

    updateActiveSession({ variants, variables: mergedVariables })
  }, [activeSession, updateActiveSession])

  const removeVariant = useCallback((id: string) => {
    if (!activeSession) return

    updateActiveSession({
      variants: activeSession.variants.filter(v => v.id !== id),
      runs: activeSession.runs.filter(r => r.variantId !== id)
    })
  }, [activeSession, updateActiveSession])

  const updateVariableValue = useCallback((name: string, value: string) => {
    if (!activeSession) return

    const variables = activeSession.variables.map(v =>
      v.name === name ? { ...v, currentValue: value } : v
    )

    updateActiveSession({ variables })
  }, [activeSession, updateActiveSession])

  const setTestInput = useCallback((input: string) => {
    updateActiveSession({ testInput: input })
  }, [updateActiveSession])

  const calculateMetrics = useCallback((
    inputTokens: number,
    outputTokens: number,
    responseTimeMs: number
  ): RunMetrics => {
    const totalTokens = inputTokens + outputTokens
    const model = models.find(m => m.id === selectedModel)
    const costPerToken = (model?.cost || 0) / 1_000_000
    const cost = totalTokens * costPerToken

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      responseTimeMs
    }
  }, [models, selectedModel])

  const runVariant = useCallback(async (variantId: string, testInput?: string) => {
    if (!activeSession || !apiKey || isRunning) return

    const variant = activeSession.variants.find(v => v.id === variantId)
    if (!variant || !variant.prompt.trim()) return

    const finalPrompt = interpolatePrompt(variant.prompt, activeSession.variables)
    const actualInput = testInput || activeSession.testInput || ''

    const fullPrompt = actualInput 
      ? `${finalPrompt}\n\nInput: ${actualInput}`
      : finalPrompt

    setRunningVariantIds(prev => [...prev, variantId])
    setStreamingOutput(prev => ({ ...prev, [variantId]: '' }))

    const startTime = Date.now()

    try {
      if (activeSession.type === 'image') {
        const imageModel = variant.imageModel || selectedImageModel
        const output = await generateImage(fullPrompt, apiKey, imageModel)

        const responseTimeMs = Date.now() - startTime
        const metrics: RunMetrics = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
          responseTimeMs
        }

        const run: TestRun = {
          id: crypto.randomUUID(),
          variantId,
          testCaseId: null,
          model: imageModel,
          output,
          outputType: 'image',
          metrics,
          rating: 0,
          notes: '',
          timestamp: Date.now()
        }

        setActiveSession(prev => {
          if (!prev) return null
          const existingRunIndex = prev.runs.findIndex(
            r => r.variantId === variantId && r.testCaseId === null
          )
          const runs = [...prev.runs]
          if (existingRunIndex >= 0) {
            runs[existingRunIndex] = run
          } else {
            runs.push(run)
          }
          return {
            ...prev,
            runs,
            updatedAt: Date.now()
          }
        })
      } else if (activeSession.type === 'edit') {
        if (!activeSession.editImage) {
          throw new Error('Please upload an image to edit')
        }
        
        const output = await editImage(fullPrompt, [activeSession.editImage], apiKey)

        const responseTimeMs = Date.now() - startTime
        const metrics: RunMetrics = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
          responseTimeMs
        }

        const run: TestRun = {
          id: crypto.randomUUID(),
          variantId,
          testCaseId: null,
          model: 'qwen-image-edit',
          output,
          outputType: 'image',
          inputImage: activeSession.editImage,
          metrics,
          rating: 0,
          notes: '',
          timestamp: Date.now()
        }

        setActiveSession(prev => {
          if (!prev) return null
          const existingRunIndex = prev.runs.findIndex(
            r => r.variantId === variantId && r.testCaseId === null
          )
          const runs = [...prev.runs]
          if (existingRunIndex >= 0) {
            runs[existingRunIndex] = run
          } else {
            runs.push(run)
          }
          return {
            ...prev,
            runs,
            updatedAt: Date.now()
          }
        })
      } else {
        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: fullPrompt
          }
        ]

        let output = ''

        await chatWithLLM(
          messages,
          apiKey,
          selectedModel,
          (chunk) => {
            output += chunk
            setStreamingOutput(prev => ({ ...prev, [variantId]: output }))
          },
          undefined,
          2048
        )

        const responseTimeMs = Date.now() - startTime
        const inputTokens = estimateTokens(fullPrompt)
        const outputTokens = estimateTokens(output)
        const metrics = calculateMetrics(inputTokens, outputTokens, responseTimeMs)

        const run: TestRun = {
          id: crypto.randomUUID(),
          variantId,
          testCaseId: null,
          model: selectedModel,
          output,
          outputType: 'text',
          metrics,
          rating: 0,
          notes: '',
          timestamp: Date.now()
        }

        setActiveSession(prev => {
          if (!prev) return null
          const existingRunIndex = prev.runs.findIndex(
            r => r.variantId === variantId && r.testCaseId === null
          )
          const runs = [...prev.runs]
          if (existingRunIndex >= 0) {
            runs[existingRunIndex] = run
          } else {
            runs.push(run)
          }
          return {
            ...prev,
            runs,
            updatedAt: Date.now()
          }
        })
      }
    } catch (error) {
      console.error('Failed to run variant:', error)
    } finally {
      setRunningVariantIds(prev => prev.filter(id => id !== variantId))
      setStreamingOutput(prev => {
        const next = { ...prev }
        delete next[variantId]
        return next
      })
    }
  }, [activeSession, apiKey, isRunning, selectedModel, selectedImageModel, calculateMetrics])

  const runAllVariants = useCallback(async (testInput?: string) => {
    if (!activeSession || isRunning) return

    const variantsToRun = activeSession.variants.filter(v => v.prompt.trim())
    if (variantsToRun.length === 0) return

    setIsRunning(true)

    for (const variant of variantsToRun) {
      await runVariant(variant.id, testInput)
    }

    setIsRunning(false)
  }, [activeSession, isRunning, runVariant])

  const updateRunRating = useCallback((runId: string, rating: number) => {
    if (!activeSession) return

    const runs = activeSession.runs.map(r =>
      r.id === runId ? { ...r, rating } : r
    )

    updateActiveSession({ runs })
  }, [activeSession, updateActiveSession])

  const updateRunNotes = useCallback((runId: string, notes: string) => {
    if (!activeSession) return

    const runs = activeSession.runs.map(r =>
      r.id === runId ? { ...r, notes } : r
    )

    updateActiveSession({ runs })
  }, [activeSession, updateActiveSession])

  const clearRuns = useCallback(() => {
    updateActiveSession({ runs: [] })
  }, [updateActiveSession])

  const setEditImage = useCallback((image: string) => {
    updateActiveSession({ editImage: image })
  }, [updateActiveSession])

  const removeEditImage = useCallback(() => {
    updateActiveSession({ editImage: undefined })
  }, [updateActiveSession])

  const updateSessionType = useCallback((type: SessionType) => {
    if (!activeSession) return
    
    const updatedVariants = activeSession.variants.map(v => ({
      ...v,
      imageModel: type === 'image' ? (v.imageModel || selectedImageModel) : v.imageModel
    }))

    updateActiveSession({ 
      type, 
      variants: updatedVariants,
      runs: []
    })
  }, [activeSession, updateActiveSession, selectedImageModel])

  const getBestPrompt = useCallback((): string | null => {
    if (!activeSession) return null

    const bestRun = getBestRun(activeSession.runs)
    if (!bestRun) return null

    const variant = activeSession.variants.find(v => v.id === bestRun.variantId)
    return variant?.prompt || null
  }, [activeSession])

  const exportBestPrompt = useCallback(async (): Promise<boolean> => {
    const bestPrompt = getBestPrompt()
    if (!bestPrompt) return false

    try {
      await navigator.clipboard.writeText(bestPrompt)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }, [getBestPrompt])

  return {
    sessions,
    activeSession,
    isLoading,
    isRunning,
    runningVariantIds,
    streamingOutput,
    createNewSession,
    selectSession,
    deleteSessionById,
    addVariant,
    updateVariant,
    removeVariant,
    updateVariableValue,
    setTestInput,
    updateSessionType,
    setEditImage,
    removeEditImage,
    runVariant,
    runAllVariants,
    updateRunRating,
    updateRunNotes,
    clearRuns,
    getBestPrompt,
    exportBestPrompt
  }
}
