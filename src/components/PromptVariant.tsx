import { type PromptVariant as PromptVariantType, type SessionType } from '@/types/playground'
import { IMAGE_MODELS } from '@/types'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { X, Play, Loader2 } from 'lucide-react'

interface PromptVariantProps {
  variant: PromptVariantType
  index: number
  sessionType: SessionType
  canDelete: boolean
  isRunning: boolean
  streamingOutput?: string
  onUpdate: (prompt: string) => void
  onImageModelChange: (imageModel: string) => void
  onRemove: () => void
  onRun: () => void
}

export function PromptVariantCard({
  variant,
  index,
  sessionType,
  canDelete,
  isRunning,
  streamingOutput,
  onUpdate,
  onImageModelChange,
  onRemove,
  onRun
}: PromptVariantProps) {
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const label = labels[index] || `${index + 1}`

  const variableCount = (variant.prompt.match(/\{\{[^}]+\}\}/g) || []).length

  return (
    <div className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary text-xs font-semibold">
            {label}
          </span>
          {variableCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {variableCount} variable{variableCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {sessionType === 'image' && (
            <Select
              value={variant.imageModel || IMAGE_MODELS[0].id}
              onValueChange={onImageModelChange}
            >
              <SelectTrigger className="h-6 w-[100px] text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id} className="text-[10px]">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRun}
            disabled={!variant.prompt.trim() || isRunning}
            className="h-6 w-6"
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              disabled={isRunning}
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-2">
        <Textarea
          value={variant.prompt}
          onChange={e => onUpdate(e.target.value)}
          placeholder={
            sessionType === 'image'
              ? 'Enter image prompt... Use {{variable:default}} for variables'
              : sessionType === 'edit'
                ? 'Enter editing instructions... Use {{variable:default}} for variables'
                : 'Enter your prompt... Use {{variable:default}} for variables'
          }
          disabled={isRunning}
          className="min-h-[80px] text-xs resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
        />
      </div>

      {isRunning && streamingOutput !== undefined && (
        <div className="px-3 pb-2">
          <div className="text-[10px] text-muted-foreground mb-1">Streaming...</div>
          <div className="text-xs text-foreground/70 line-clamp-3 whitespace-pre-wrap">
            {streamingOutput}
          </div>
        </div>
      )}
    </div>
  )
}
