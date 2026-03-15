import { type Settings } from '@/types'

const SETTINGS_KEY = 'chatbot_settings'

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const loadSettings = (): Settings => {
  const data = localStorage.getItem(SETTINGS_KEY)
  if (!data) {
    return {
      apiKey: '',
      instructions: '',
      selectedProvider: 'chutes',
      selectedModel: 'unsloth/gemma-3-27b-it',
      selectedImageModel: 'glm-image',
      selectedVisionModel: '',
      selectedVideoResolution: '480p',
      maxAgenticIterations: 3
    }
  }
  try {
    const parsed = JSON.parse(data)
    if (!parsed.selectedProvider) {
      parsed.selectedProvider = 'chutes'
    }
    if (parsed.selectedImageModel !== 'glm-image') {
      parsed.selectedImageModel = 'glm-image'
    }
    // Ensure selectedVideoResolution has a default value
    if (!parsed.selectedVideoResolution) {
      parsed.selectedVideoResolution = '480p'
    }
    // Ensure maxAgenticIterations has a default value
    if (
      !parsed.maxAgenticIterations ||
      parsed.maxAgenticIterations < 1 ||
      parsed.maxAgenticIterations > 10
    ) {
      parsed.maxAgenticIterations = 3
    }
    return parsed
  } catch {
    return {
      apiKey: '',
      instructions: '',
      selectedProvider: 'chutes',
      selectedModel: 'unsloth/gemma-3-27b-it',
      selectedImageModel: 'glm-image',
      selectedVisionModel: '',
      selectedVideoResolution: '480p',
      maxAgenticIterations: 3
    }
  }
}
