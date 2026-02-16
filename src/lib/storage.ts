import { type Conversation, type Settings } from '@/types'

const CONVERSATIONS_KEY = 'chatbot_conversations'
const SETTINGS_KEY = 'chatbot_settings'

export const saveConversations = (conversations: Conversation[]): void => {
  const conversationsToSave = conversations.map(conv => ({
    ...conv,
    messages: conv.messages.map(msg => ({
      ...msg,
      images: undefined,
      generatedImages: undefined
    }))
  }))
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversationsToSave))
}

export const loadConversations = (): Conversation[] => {
  const data = localStorage.getItem(CONVERSATIONS_KEY)
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const loadSettings = (): Settings => {
  const data = localStorage.getItem(SETTINGS_KEY)
  if (!data) {
    return {
      apiKey: '',
      instructions: '',
      selectedModel: 'unsloth/gemma-3-27b-it',
      selectedImageModel: 'z-image-turbo'
    }
  }
  try {
    return JSON.parse(data)
  } catch {
    return {
      apiKey: '',
      instructions: '',
      selectedModel: 'unsloth/gemma-3-27b-it',
      selectedImageModel: 'z-image-turbo'
    }
  }
}
