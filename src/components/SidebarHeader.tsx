import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarHeaderProps {
  onNewChat: () => void
}

export function SidebarHeader({ onNewChat }: SidebarHeaderProps) {
  return (
    <div className="p-3">
      <Button
        onClick={onNewChat}
        className={cn(
          'w-full justify-start gap-2.5',
          'bg-gradient-to-r from-primary/10 to-primary/5',
          'border border-primary/20 text-foreground',
          'hover:from-primary/15 hover:to-primary/10 hover:border-primary/30',
          'transition-all duration-200'
        )}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm font-medium">New Chat</span>
      </Button>
    </div>
  )
}
