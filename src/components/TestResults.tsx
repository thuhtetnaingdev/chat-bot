import { useState } from 'react'
import { type TestRun, type PromptVariant, type SessionType, getBestRun } from '@/types/playground'
import { IMAGE_MODELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star, Copy, Check, Loader2, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TestResultsProps {
  sessionType: SessionType
  variants: PromptVariant[]
  runs: TestRun[]
  runningVariantIds: string[]
  streamingOutput: Record<string, string>
  onUpdateRating: (runId: string, rating: number) => void
  onUpdateNotes: (runId: string, notes: string) => void
}

export function TestResults({
  sessionType,
  variants,
  runs,
  runningVariantIds,
  streamingOutput,
  onUpdateRating,
  onUpdateNotes
}: TestResultsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [previewRun, setPreviewRun] = useState<TestRun | null>(null)

  const bestRun = getBestRun(runs)

  const getModelName = (modelId: string) => {
    const model = IMAGE_MODELS.find(m => m.id === modelId)
    return model?.name || modelId
  }

  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const getRunForVariant = (variantId: string): TestRun | undefined => {
    return runs.find(r => r.variantId === variantId)
  }

  const handleCopy = async (run: TestRun) => {
    try {
      await navigator.clipboard.writeText(run.output)
      setCopiedId(run.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownloadImage = (run: TestRun) => {
    const link = document.createElement('a')
    link.href = run.output
    link.download = `generated-${run.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatCost = (cost: number): string => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(3)}`
  }

  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Add variants to see results
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {variants.map((variant, index) => {
        const run = getRunForVariant(variant.id)
        const isRunning = runningVariantIds.includes(variant.id)
        const isBest = bestRun?.id === run?.id
        const streamOutput = streamingOutput[variant.id]
        const isImageOutput = run?.outputType === 'image'

        return (
          <div
            key={variant.id}
            className={cn(
              'border rounded-lg overflow-hidden',
              isBest ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-card/50'
            )}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                  {labels[index]}
                </span>
                {isBest && <span className="text-[10px] text-primary font-medium">Best</span>}
                {isRunning && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {sessionType === 'image' ? 'Generating...' : 'Running...'}
                  </span>
                )}
              </div>

              {run && !isRunning && sessionType === 'text' && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{run.metrics.totalTokens} tok</span>
                  <span>{formatCost(run.metrics.cost)}</span>
                  <span>{formatTime(run.metrics.responseTimeMs)}</span>
                </div>
              )}
            </div>

            <div className="p-3">
              {isRunning && streamOutput && sessionType === 'text' ? (
                <div className="text-xs text-foreground/70 whitespace-pre-wrap min-h-[60px]">
                  {streamOutput}
                </div>
              ) : isRunning && (sessionType === 'image' || sessionType === 'edit') ? (
                <div className="text-xs text-muted-foreground text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  {sessionType === 'edit' ? 'Editing image...' : 'Generating image...'}
                </div>
              ) : run ? (
                <>
                  {isImageOutput && run.inputImage && sessionType === 'edit' ? (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Input</p>
                        <img src={run.inputImage} alt="Input" className="w-full rounded-lg" />
                      </div>
                      <div className="relative group">
                        <p className="text-[10px] text-muted-foreground mb-1">Output</p>
                        <img
                          src={run.output}
                          alt="Output"
                          className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPreviewRun(run)}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownloadImage(run)}
                          className="absolute bottom-2 right-2 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ) : isImageOutput ? (
                    <div className="relative group mb-3">
                      <img
                        src={run.output}
                        alt="Generated"
                        className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewRun(run)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownloadImage(run)}
                        className="absolute bottom-2 right-2 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-foreground/80 whitespace-pre-wrap mb-3 max-h-[200px] overflow-y-auto">
                      {run.output}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => onUpdateRating(run.id, star)}
                          className="p-0.5 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={cn(
                              'h-4 w-4',
                              star <= run.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground/30'
                            )}
                          />
                        </button>
                      ))}
                    </div>

                    <Textarea
                      value={run.notes}
                      onChange={e => onUpdateNotes(run.id, e.target.value)}
                      placeholder="Add notes..."
                      className="min-h-[40px] text-xs resize-none"
                    />

                    {!isImageOutput && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(run)}
                        className="h-7 text-xs"
                      >
                        {copiedId === run.id ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy Output
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Click run to generate{' '}
                  {sessionType === 'image'
                    ? 'image'
                    : sessionType === 'edit'
                      ? 'edited image'
                      : 'output'}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Image Preview Modal */}
      {previewRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewRun(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-card rounded-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Image Preview</span>
                <span className="text-xs text-muted-foreground">
                  {getModelName(previewRun.model)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadImage(previewRun)}
                  className="h-8 text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewRun(null)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {previewRun.inputImage && sessionType === 'edit' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Input</p>
                    <img src={previewRun.inputImage} alt="Input" className="w-full rounded-lg" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Output</p>
                    <img src={previewRun.output} alt="Output" className="w-full rounded-lg" />
                  </div>
                </div>
              ) : (
                <img
                  src={previewRun.output}
                  alt="Preview"
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
