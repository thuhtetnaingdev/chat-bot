import { useState } from 'react'
import { type Model } from '@/types'
import { usePlayground } from '@/hooks/usePlayground'
import { PromptVariantCard } from './PromptVariant'
import { TestResults } from './TestResults'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  Play,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Type,
  ImageIcon
} from 'lucide-react'
import { MAX_VARIANTS } from '@/types/playground'
import { cn } from '@/lib/utils'

interface PromptPlaygroundProps {
  apiKey: string
  selectedModel: string
  onModelChange: (model: string) => void
  models: Model[]
  selectedImageModel: string
}

export function PromptPlayground({
  apiKey,
  selectedModel,
  models,
  selectedImageModel
}: PromptPlaygroundProps) {
  const {
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
    exportBestPrompt
  } = usePlayground(apiKey, selectedModel, models, selectedImageModel)

  const [showVariables, setShowVariables] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [copiedBest, setCopiedBest] = useState(false)

  const handleDeleteSession = async () => {
    if (deleteTargetId) {
      await deleteSessionById(deleteTargetId)
      setDeleteTargetId(null)
      setShowDeleteDialog(false)
    }
  }

  const confirmDeleteSession = (id: string) => {
    setDeleteTargetId(id)
    setShowDeleteDialog(true)
  }

  const handleExportBest = async () => {
    const success = await exportBestPrompt()
    if (success) {
      setCopiedBest(true)
      setTimeout(() => setCopiedBest(false), 2000)
    }
  }

  const hasRuns = activeSession && activeSession.runs.length > 0
  const hasRatedRuns = activeSession && activeSession.runs.some(r => r.rating > 0)
  const canAddVariant = activeSession && activeSession.variants.length < MAX_VARIANTS

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FlaskConical className="h-12 w-12 text-muted-foreground/50" />
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Prompt Playground</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create and compare prompt variations to find the best one
          </p>
          <Button onClick={createNewSession}>
            <Plus className="h-4 w-4 mr-2" />
            Create Session
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Select value={activeSession.id} onValueChange={selectSession}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(session => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={createNewSession} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>

            {sessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => confirmDeleteSession(activeSession.id)}
                disabled={isRunning}
                className="h-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Session Type Toggle */}
            <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => updateSessionType('text')}
                disabled={isRunning}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors',
                  activeSession.type === 'text'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                <Type className="h-3 w-3" />
                Text
              </button>
              <button
                type="button"
                onClick={() => updateSessionType('image')}
                disabled={isRunning}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors',
                  activeSession.type === 'image'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                <ImageIcon className="h-3 w-3" />
                Image
              </button>
              <button
                type="button"
                onClick={() => updateSessionType('edit')}
                disabled={isRunning}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors',
                  activeSession.type === 'edit'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                <ImageIcon className="h-3 w-3" />
                Edit
              </button>
            </div>

            {hasRatedRuns && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportBest}
                disabled={isRunning}
                className="h-8"
              >
                {copiedBest ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Export Best
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4">
        {/* Left Panel - Variants & Variables */}
        <div className="w-1/2 flex flex-col gap-4 overflow-hidden">
          {/* Edit Image Upload Section */}
          {activeSession.type === 'edit' && (
            <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">Source Image</span>
              </div>
              <div className="p-3">
                {!activeSession.editImage ? (
                  <div className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const { processImageFile } = await import('@/lib/api')
                          const base64 = await processImageFile(file)
                          setEditImage(base64)
                        }
                      }}
                      className="hidden"
                      id="edit-image-upload"
                    />
                    <label
                      htmlFor="edit-image-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <ImageIcon className="h-8 w-8 mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Click to upload image</p>
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={activeSession.editImage}
                      alt="Source"
                      className="w-full max-h-[150px] object-contain rounded"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={removeEditImage}
                      disabled={isRunning}
                      className="absolute top-2 right-2 h-6 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Variants Section */}
          <div className="flex-1 overflow-hidden flex flex-col border border-border/50 rounded-lg bg-card/30">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">
                Variants ({activeSession.variants.length}/{MAX_VARIANTS})
              </span>
              {canAddVariant && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addVariant}
                  disabled={isRunning}
                  className="h-6 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeSession.variants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  <p className="mb-2">No variants yet</p>
                  <Button variant="outline" size="sm" onClick={addVariant} disabled={isRunning}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Variant
                  </Button>
                </div>
              ) : (
                activeSession.variants.map((variant, index) => (
                  <PromptVariantCard
                    key={variant.id}
                    variant={variant}
                    index={index}
                    sessionType={activeSession.type}
                    canDelete={activeSession.variants.length > 1}
                    isRunning={runningVariantIds.includes(variant.id)}
                    streamingOutput={streamingOutput[variant.id]}
                    onUpdate={prompt => updateVariant(variant.id, { prompt })}
                    onImageModelChange={imageModel => updateVariant(variant.id, { imageModel })}
                    onRemove={() => removeVariant(variant.id)}
                    onRun={() => runVariant(variant.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Variables Section */}
          {activeSession.variables.length > 0 && (
            <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  Variables ({activeSession.variables.length})
                </span>
                {showVariables ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {showVariables && (
                <div className="p-3 space-y-2">
                  {activeSession.variables.map(variable => (
                    <div key={variable.name} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">
                        {`{{${variable.name}}}`}
                      </span>
                      <input
                        type="text"
                        value={variable.currentValue}
                        onChange={e => updateVariableValue(variable.name, e.target.value)}
                        placeholder={variable.defaultValue || 'Enter value...'}
                        disabled={isRunning}
                        className="flex-1 px-2 py-1 text-xs border border-border/50 rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring/20"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Test Input Section */}
          <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">
                Test Input (optional)
              </span>
            </div>
            <div className="p-2">
              <Textarea
                value={activeSession.testInput}
                onChange={e => setTestInput(e.target.value)}
                placeholder="Add optional input to test prompts against..."
                disabled={isRunning}
                className="min-h-[60px] text-xs resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="w-1/2 flex flex-col overflow-hidden border border-border/50 rounded-lg bg-card/30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">Results</span>
            <div className="flex items-center gap-2">
              {hasRuns && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRuns}
                  disabled={isRunning}
                  className="h-6 text-xs"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => runAllVariants()}
                disabled={activeSession.variants.length === 0 || isRunning}
                className="h-6 text-xs"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Run All
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <TestResults
              sessionType={activeSession.type}
              variants={activeSession.variants}
              runs={activeSession.runs}
              runningVariantIds={runningVariantIds}
              streamingOutput={streamingOutput}
              onUpdateRating={updateRunRating}
              onUpdateNotes={updateRunNotes}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px] border-border/50">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Session</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Are you sure you want to delete this session? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSession} className="text-xs">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
