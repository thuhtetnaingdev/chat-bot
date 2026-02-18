import { ConversationList } from './ConversationList'
import { SidebarHeader } from './SidebarHeader'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { FlaskConical } from 'lucide-react'
import { type Conversation } from '@/types'

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
  return (
    <aside className="flex h-full w-full flex-col border-r border-border/50 bg-sidebar/10 backdrop-blur-sm">
      <SidebarHeader onNewChat={onNewChat} />
      <Separator className="bg-border/50" />
      
      <div className="flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={onSelectConversation}
          onDeleteConversation={onDeleteConversation}
          onRenameConversation={onRenameConversation}
        />
      </div>

      <Separator className="bg-border/50" />
      
      <div className="p-3">
        <Button
          variant={isLabOpen ? 'default' : 'outline'}
          onClick={onOpenLab}
          className="w-full justify-start gap-2"
        >
          <FlaskConical className="h-4 w-4" />
          <span className="text-sm">Lab</span>
        </Button>
      </div>
    </aside>
  )
}
