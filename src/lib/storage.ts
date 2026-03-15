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
      selectedModel: 'unsloth/gemma-3-27b-it',
      selectedImageModel: 'z-image-turbo',
      selectedVisionModel: '',
      selectedVideoResolution: '480p',
      maxAgenticIterations: 3
    }
  }
  try {
    const parsed = JSON.parse(data)
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
      selectedModel: 'unsloth/gemma-3-27b-it',
      selectedImageModel: 'z-image-turbo',
      selectedVisionModel: '',
      selectedVideoResolution: '480p',
      maxAgenticIterations: 3
    }
  }
}
