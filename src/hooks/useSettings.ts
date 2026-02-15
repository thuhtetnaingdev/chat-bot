import { useState } from 'react'
import { type Settings } from '@/types'
import { loadSettings, saveSettings } from '@/lib/storage'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const updateSettings = (updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  return { settings, updateSettings, isLoaded: true }
}
