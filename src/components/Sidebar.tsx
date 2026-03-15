import { useState } from 'react'
import { ConversationList } from './ConversationList'
import { Button } from '@/components/ui/button'
import { FlaskConical, Plus } from 'lucide-react'
import { type Conversation } from '@/types'
import { cn } from '@/lib/utils'

interface SidebarProps {
  conversations: Conversation[]
  currentConversationId: string | null
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, newTitle: string) => void
  onOpenLab: () => void
  isLabOpen: boolean
}

export function Sidebar({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onOpenLab,
  isLabOpen
}: SidebarProps) {
  const [isAllChatsExpanded, setIsAllChatsExpanded] = useState(true)
  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      {/* Logo Area */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/80 to-primary/60 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">AI</span>
          </div>
          <button className="p-1 hover:bg-sidebar-accent/50 rounded-md transition-colors">
            <svg
              className="w-4 h-4 text-sidebar-foreground/70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-3 py-2">
        <Button
          onClick={onNewChat}
          variant="ghost"
          className="w-full justify-start gap-3 h-9 px-3 text-sm font-normal text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 h-px bg-sidebar-border" />

      {/* Conversations */}
      <div className="flex-1 overflow-hidden">
        <div className="px-3 py-2">
          <button
            onClick={() => setIsAllChatsExpanded(!isAllChatsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
          >
            <span>All chats</span>
            <ChevronIcon
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isAllChatsExpanded ? 'rotate-180' : ''
              )}
            />
          </button>
        </div>
        {isAllChatsExpanded && (
          <ConversationList
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
            onRenameConversation={onRenameConversation}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant={isLabOpen ? 'secondary' : 'ghost'}
          onClick={onOpenLab}
          className="w-full justify-start gap-3 h-9 px-3 text-sm font-normal"
        >
          <FlaskConical className="h-4 w-4" />
          Lab
        </Button>
      </div>
    </aside>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
