import { type Model } from '@/types'

const LLM_API_URL = 'https://llm.chutes.ai/v1/chat/completions'
const MODELS_URL = 'https://models.dev/api.json'

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

export const chatWithLLM = async (
  messages: Array<{ role: string; content: string }>,
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
      throw new Error('Request was cancelled')
    }
    throw error
  }
}
