import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSettings } from './hooks/useSettings'
import { useChat } from './hooks/useChat'
import { Sidebar } from './components/Sidebar'
import { ChatContainer } from './components/ChatContainer'
import { ChatInput } from './components/ChatInput'
import { PromptPlayground } from './components/PromptPlayground'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Settings, Menu, X, Loader2 } from 'lucide-react'
import { fetchModels } from './lib/api'
import { type Model } from './types'
import { cn } from '@/lib/utils'
import Login from './pages/Login'
import Register from './pages/Register'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

function App() {
  const { settings, updateSettings, isLoaded: settingsLoaded } = useSettings()

  const [showSettings, setShowSettings] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showLab, setShowLab] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  const {
    conversations,
    currentConversation,
    currentConversationId,
    isStreaming,
    isLoading: isLoadingConversations,
    storageError,
    createNewConversation,
    sendMessage,
    deleteConversation,
    renameConversation,
    stopStreaming,
    selectConversation
  } = useChat(settings, models)
  const [isThinking, setIsThinking] = useState(false)
  const modelsLoadedRef = useRef(false)

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return

    setIsLoadingModels(true)
    try {
      const fetchedModels = await fetchModels()
      console.log('Loaded models:', fetchedModels)
      setModels(fetchedModels)
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      setIsLoadingModels(false)
      modelsLoadedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.apiKey])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  if (!settingsLoaded || isLoadingConversations) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {isLoadingConversations ? 'Loading conversations...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (storageError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-foreground">
        <div className="text-center max-w-md p-6">
          <p className="text-destructive mb-4">Storage Error</p>
          <p className="text-sm text-muted-foreground mb-4">{storageError}</p>
          <p className="text-xs text-muted-foreground">
            Please try using a different browser or disable private browsing mode.
          </p>
        </div>
      </div>
    )
  }

  const handleSendMessage = async (
    message: string,
    images?: string[],
    activeTool?: string,
    visionModel?: string,
    imageModel?: string,
    videoResolution?: string,
    maxAgenticIterations?: number
  ) => {
    setIsThinking(true)
    await sendMessage(
      message,
      images,
      activeTool,
      visionModel,
      imageModel,
      videoResolution,
      maxAgenticIterations
    )
    setIsThinking(false)
  }

  const handleOpenLab = () => {
    setShowLab(true)
    setShowSidebar(false)
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/" element={<div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Mobile Sidebar Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity',
          showSidebar ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setShowSidebar(false)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:relative z-50 h-full w-72 transform transition-transform duration-300 ease-in-out md:translate-x-0',
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewChat={() => {
            createNewConversation()
            setShowSidebar(false)
            setShowLab(false)
          }}
          onSelectConversation={id => {
            selectConversation(id)
            setShowSidebar(false)
            setShowLab(false)
          }}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onOpenLab={handleOpenLab}
          isLabOpen={showLab}
        />
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-2 sm:gap-3 border-b border-border/50 bg-card/30 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 hover:bg-accent/50 h-9 w-9"
            onClick={() => setShowSidebar(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <h1
            className={cn(
              'truncate font-semibold tracking-tight flex-1 min-w-0',
              'text-sm sm:text-base md:text-lg'
            )}
          >
            {showLab ? 'Prompt Playground' : currentConversation?.title || 'New Chat'}
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            {isLoadingModels ? (
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                <span className="hidden sm:inline">Loading...</span>
              </div>
            ) : models.length > 0 ? (
              <Select
                value={settings.selectedModel}
                onValueChange={value => updateSettings({ selectedModel: value })}
              >
                <SelectTrigger className="w-[120px] sm:w-[160px] md:w-[200px] lg:w-[260px] h-8 sm:h-9 text-[10px] sm:text-xs">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">{model.name}</span>
                        {model.cost !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            ${model.cost}/1M tokens
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">
                {settings.apiKey ? 'No models available' : 'Set API key to load models'}
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="h-9 w-9 shrink-0"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        {showLab ? (
          <PromptPlayground
            apiKey={settings.apiKey}
            selectedModel={settings.selectedModel}
            onModelChange={value => updateSettings({ selectedModel: value })}
            models={models}
            selectedImageModel={settings.selectedImageModel || 'z-image-turbo'}
          />
        ) : (
          <>
            {/* Chat Area */}
            <ChatContainer
              conversation={currentConversation || null}
              isStreaming={isStreaming}
              apiKey={settings.apiKey}
            />

            {/* Input Area */}
            <ChatInput
              onSend={handleSendMessage}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              disabled={!settings.apiKey}
              apiKey={settings.apiKey}
              isThinking={isThinking}
              selectedImageModel={settings.selectedImageModel || 'z-image-turbo'}
              onImageModelChange={value => updateSettings({ selectedImageModel: value })}
              selectedVisionModel={settings.selectedVisionModel}
              onVisionModelChange={value => updateSettings({ selectedVisionModel: value })}
              selectedVideoResolution={settings.selectedVideoResolution || '480p'}
              onVideoResolutionChange={value => updateSettings({ selectedVideoResolution: value })}
              maxAgenticIterations={settings.maxAgenticIterations || 3}
              onMaxAgenticIterationsChange={value =>
                updateSettings({ maxAgenticIterations: value })
              }
              models={models}
            />
          </>
        )}
      </main>

      {/* Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-lg overflow-auto rounded-xl border border-border/50 bg-card shadow-xl p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
                className="hover:bg-accent/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Chutes API Key
                </label>
                <input
                  type="password"
                  className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:ring-offset-0 transition-all"
                  placeholder="Enter your Chutes API key"
                  value={settings.apiKey}
                  onChange={e => {
                    updateSettings({ apiKey: e.target.value })
                    if (e.target.value && !modelsLoadedRef.current) {
                      setIsLoadingModels(true)
                      modelsLoadedRef.current = true
                      fetchModels()
                        .then(fetchedModels => {
                          console.log('Settings dialog loaded models:', fetchedModels)
                          setModels(fetchedModels)
                        })
                        .catch(() => {})
                        .finally(() => {
                          setIsLoadingModels(false)
                        })
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground/70">
                  Your API key is stored locally in your browser.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  System Instructions
                </label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:ring-offset-0 resize-none transition-all"
                  placeholder="Add custom instructions for the AI assistant..."
                  value={settings.instructions}
                  onChange={e => updateSettings({ instructions: e.target.value })}
                  rows={4}
                />
                <p className="text-[10px] text-muted-foreground/70">
                  These instructions will guide the AI's responses.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Default Model
                </label>
                {isLoadingModels ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading models...
                  </div>
                ) : models.length > 0 ? (
                  <Select
                    value={settings.selectedModel}
                    onValueChange={value => updateSettings({ selectedModel: value })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select default model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col">
                            <span className="font-medium text-xs">{model.name}</span>
                            {model.cost && (
                              <span className="text-[10px] text-muted-foreground">
                                ${model.cost}/1M tokens
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[10px] text-muted-foreground/70">
                    {settings.apiKey ? 'No models available' : 'Enter your API key to load models'}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button onClick={() => setShowSettings(false)} className="text-xs">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    } />
    </Routes>
  )
}

export default App
