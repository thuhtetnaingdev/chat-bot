export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export interface Settings {
  apiKey: string
  instructions: string
  selectedModel: string
}

export interface Model {
  id: string
  name: string
  cost: number
}
