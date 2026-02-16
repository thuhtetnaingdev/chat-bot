import { type Model, IMAGE_MODELS } from '@/types'

const LLM_API_URL = 'https://llm.chutes.ai/v1/chat/completions'
const MODELS_URL = 'https://models.dev/api.json'
const WHISPER_URL = 'https://chutes-whisper-large-v3.chutes.ai/transcribe'
const KOKORO_TTS_URL = 'https://chutes-kokoro.chutes.ai/speak'

const getImageGenerationUrl = (modelId: string): string => {
  const model = IMAGE_MODELS.find(m => m.id === modelId)
  return model?.url || 'https://chutes-z-image-turbo.chutes.ai/generate'
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const generateImage = async (
  prompt: string,
  apiKey: string,
  imageModel = 'z-image-turbo'
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key required for image generation')
  }

  try {
    const response = await fetch(getImageGenerationUrl(imageModel), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Image generation failed with status ${response.status}: ${errorText}`)
    }

    const contentType = response.headers.get('content-type')
    
    // If response is an image, convert to base64
    if (contentType && contentType.startsWith('image/')) {
      const blob = await response.blob()
      return await blobToBase64(blob)
    }

    // Otherwise, try to parse as JSON
    const data = await response.json()

    // Handle base64 response
    if (data.image) {
      return data.image
    }

    // Handle URL response (fallback)
    if (data.url) {
      return data.url
    }

    // Handle array of images
    if (Array.isArray(data.images) && data.images.length > 0) {
      return data.images[0]
    }

    throw new Error('No image data in response')
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown image generation error')
  }
}

export const transcribeAudio = async (
  audioBlob: Blob,
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key required for transcription')
  }

  try {
    const audioBase64 = await blobToBase64(audioBlob)

    const response = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_b64: audioBase64 })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Transcription failed with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Handle array response format from Whisper API
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: { text?: string }) => item.text || '').join(' ').trim()
    }

    // Handle object response format
    return data.transcription || data.text || ''
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown transcription error')
  }
}

export const textToSpeech = async (
  text: string,
  apiKey: string
): Promise<Blob> => {
  if (!apiKey) {
    throw new Error('API key required for text-to-speech')
  }

  try {
    const response = await fetch(KOKORO_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Text-to-speech failed with status ${response.status}: ${errorText}`)
    }

    return await response.blob()
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown text-to-speech error')
  }
}

export const performOCR = async (
  imageBase64: string,
  apiKey: string,
  onChunk: (content: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key required for OCR')
  }

  const requestBody = {
    model: 'rednote-hilab/dots.ocr',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract and transcribe all text from this image. Provide the full text content as it appears.'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64
            }
          }
        ]
      }
    ],
    stream: true,
    max_tokens: 2048,
    temperature: 0.1
  }

  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OCR request failed with status ${response.status}: ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim() !== '')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              onChunk(content)
            }
          } catch {
            // Ignore JSON parse errors for malformed chunks
          }
        }
      }
    }

    return fullContent
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OCR request was cancelled')
    }
    throw error
  }
}

export const processImageFile = async (file: File): Promise<string> => {
  return await fileToBase64(file)
}

export const fetchModels = async (): Promise<Model[]> => {
  try {

    const response = await fetch(MODELS_URL)
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }
    
    const data = await response.json()
    console.log('API Response:', data)
    const chutesModels = data.chutes?.models || {}
    const modelsArray = Object.values(chutesModels).map((model: unknown): Model => {
      const m = model as { id: string; name: string; cost: unknown }
      const costModel = m.cost
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cost = typeof costModel === 'object' && costModel !== null && 'input' in costModel ? (costModel as any).input : undefined
      return {
        id: m.id,
        name: m.name,
        cost
      }
    })
    console.log('Fetched models:', modelsArray)
    return modelsArray
  } catch (error) {
    console.error('Failed to fetch models:', error)
    console.error('Using fallback models list')
    
    // Fallback list of common models if API fails
    return [
      {
        id: 'unsloth/gemma-3-27b-it',
        name: 'Unsloth Gemma 3 27B IT',
        cost: 0.5
      },
      {
        id: 'meta-llama/Llama-3.3-8B-Instruct',
        name: 'Meta Llama 3.3 8B Instruct',
        cost: 0.25
      },
      {
        id: 'deepseek-ai/DeepSeek-R1',
        name: 'DeepSeek R1',
        cost: 1.0
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen 2.5 72B Instruct',
        cost: 0.75
      },
      {
        id: 'mistralai/Mistral-Nemo',
        name: 'Mistral Nemo',
        cost: 0.3
      }
    ]
  }
}

export interface MessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface ChatMessage {
  role: string
  content: string | MessageContent[]
}

export const chatWithLLM = async (
  messages: ChatMessage[],
  apiKey: string,
  model = 'unsloth/gemma-3-27b-it',
  onChunk: (content: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  if (!apiKey) {
    throw new Error('Chutes API key not found. Please add your API key in the settings.')
  }

  const requestBody = {
    model,
    messages,
    stream: true,
    max_tokens: 1024,
    temperature: 0.7
  }

  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed with status ${response.status}: ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let inThinkMode = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim() !== '')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            // DeepSeek R1 returns thinking content in reasoning_content field
            const reasoningContent = delta?.reasoning_content || ''
            const content = delta?.content || ''
            
            // Handle reasoning content (thinking)
            if (reasoningContent) {
              // Start think block if not already started
              if (!inThinkMode) {
                fullContent += '<think>'
                onChunk('<think>')
                inThinkMode = true
              }
              fullContent += reasoningContent
              onChunk(reasoningContent)
            }
            
            // Handle regular content
            if (content) {
              // Close think block if we're transitioning from reasoning to content
              if (inThinkMode) {
                fullContent += '</think>'
                onChunk('</think>')
                inThinkMode = false
              }
              fullContent += content
              onChunk(content)
            }
          } catch {
            // Ignore JSON parse errors for malformed chunks
          }
        }
      }
    }

    return fullContent
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request was cancelled')
    }
    throw error
  }
}
