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
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URI prefix (e.g., "data:audio/wav;base64,") to get raw base64
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Convert audio blob to WAV format
const convertToWav = async (audioBlob: Blob): Promise<Blob> => {
  const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const audioContext = new AudioContextClass()
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length
    
    // Create buffer for WAV file
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(buffer)
    
    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)
    
    // Write audio data
    const channels = []
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i))
    }
    
    let index = 0
    const offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]))
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(offset + index, intSample, true)
        index += 2
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' })
  } finally {
    audioContext.close()
  }
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
    
    // If response is an image, convert to base64 data URL
    if (contentType && contentType.startsWith('image/')) {
      const blob = await response.blob()
      const reader = new FileReader()
      return new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
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

export const editImage = async (
  prompt: string,
  images: string[],
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key required for image editing')
  }

  if (!images || images.length === 0) {
    throw new Error('Please upload at least one image to edit')
  }

  try {
    // Strip data URL prefix from images (e.g., "data:image/png;base64," -> "")
    const cleanImages = images.map(img => {
      const commaIndex = img.indexOf(',')
      return commaIndex !== -1 ? img.slice(commaIndex + 1) : img
    })

    const response = await fetch('https://chutes-qwen-image-edit-2511.chutes.ai/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_b64s: cleanImages
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Image editing failed with status ${response.status}: ${errorText}`)
    }

    const contentType = response.headers.get('content-type')
    
    // If response is an image, convert to base64 data URL
    if (contentType && contentType.startsWith('image/')) {
      const blob = await response.blob()
      const reader = new FileReader()
      return new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
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
    throw new Error('Unknown image editing error')
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
    // Convert webm to wav format for better compatibility
    const wavBlob = await convertToWav(audioBlob)
    const audioBase64 = await blobToBase64(wavBlob)

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
      const m = model as { 
        id: string; 
        name: string; 
        cost: unknown; 
        limit?: { output?: number }
        modalities?: { input?: string[]; output?: string[] }
      }
      const costModel = m.cost
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cost = typeof costModel === 'object' && costModel !== null && 'input' in costModel ? (costModel as any).input : undefined
      return {
        id: m.id,
        name: m.name,
        cost,
        max_tokens: m.limit?.output,
        modalities: m.modalities ? {
          input: m.modalities.input || [],
          output: m.modalities.output || []
        } : undefined
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
        cost: 0.5,
        max_tokens: 65536
      },
      {
        id: 'meta-llama/Llama-3.3-8B-Instruct',
        name: 'Meta Llama 3.3 8B Instruct',
        cost: 0.25,
        max_tokens: 8192
      },
      {
        id: 'deepseek-ai/DeepSeek-R1',
        name: 'DeepSeek R1',
        cost: 1.0,
        max_tokens: 65536
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen 2.5 72B Instruct',
        cost: 0.75,
        max_tokens: 32768
      },
      {
        id: 'mistralai/Mistral-Nemo',
        name: 'Mistral Nemo',
        cost: 0.3,
        max_tokens: 131072
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
  signal?: AbortSignal,
  max_tokens?: number
): Promise<string> => {
  if (!apiKey) {
    throw new Error('Chutes API key not found. Please add your API key in the settings.')
  }

  const requestBody = {
    model,
    messages,
    stream: true,
    max_tokens: max_tokens || 1024,
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
