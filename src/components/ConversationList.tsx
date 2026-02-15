import * as React from 'react'
import { useState, type KeyboardEvent } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Edit2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Conversation } from '@/types'

interface ConversationListProps {
  conversations: Conversation[]
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, newTitle: string) => void
}

export function ConversationList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation
}: ConversationListProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  const handleRenameClick = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(conversation.id)
    setNewTitle(conversation.title)
    setRenameDialogOpen(true)
  }

  const handleRenameSave = () => {
    if (renamingId && newTitle.trim()) {
      onRenameConversation(renamingId, newTitle.trim())
    }
    setRenameDialogOpen(false)
    setRenamingId(null)
    setNewTitle('')
  }

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteConversation(id)
  }

  const handleConversationClick = (id: string) => {
    onSelectConversation(id)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSave()
    }
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                'group relative flex items-start gap-2 rounded-lg p-2.5 transition-all duration-200 border border-transparent',
                currentConversationId === conversation.id
                  ? 'bg-sidebar-accent/20 border-sidebar-accent/40 text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/10 hover:border-sidebar-accent/20 hover:text-sidebar-accent-foreground text-sidebar-foreground/70'
              )}
              onMouseEnter={() => setHoveredId(conversation.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleConversationClick(conversation.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 opacity-70 group-hover:opacity-100 transition-opacity" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-relaxed">
                  {conversation.title.slice(0, 15)}{conversation.title.length > 15 ? '...' : ''}
                </p>
              </div>
              
              {(hoveredId === conversation.id || currentConversationId === conversation.id) && (
                <div className={cn(
                  "flex gap-0.5 shrink-0",
                  currentConversationId === conversation.id 
                    ? "opacity-100" 
                    : "opacity-0 transition-opacity group-hover:opacity-100"
                )}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => handleRenameClick(conversation, e)}
                    className="h-6 w-6 hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => handleDeleteClick(conversation.id, e)}
                    className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          
          {conversations.length === 0 && (
            <div className="py-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground/70">No conversations yet</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border-border/50">
          <DialogHeader>
            <DialogTitle className="text-sm">Rename Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs">Title</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Conversation title"
                onKeyDown={handleKeyDown}
                autoFocus
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button onClick={handleRenameSave} disabled={!newTitle.trim()} className="text-xs">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
