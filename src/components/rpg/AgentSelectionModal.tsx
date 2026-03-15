import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { RPG_AGENT_TEMPLATES, AGENT_AVATARS, AGENT_COLORS, type RPGAgent } from '@/types/rpg'

interface AgentSelectionModalProps {
  isOpen: boolean
  defaultTopic?: string
  onClose: () => void
  onStart: (topic: string, agents: RPGAgent[]) => void
}

export function AgentSelectionModal({
  isOpen,
  defaultTopic = '',
  onClose,
  onStart
}: AgentSelectionModalProps) {
  const [topic, setTopic] = useState(defaultTopic)
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['wizard', 'bard', 'rogue'])
  const [maxAgents] = useState(4)

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => {
      if (prev.includes(agentId)) {
        return prev.filter(id => id !== agentId)
      }
      if (prev.length >= maxAgents) {
        return prev
      }
      return [...prev, agentId]
    })
  }

  const handleStart = () => {
    if (topic.trim() && selectedAgents.length > 0) {
      const agents = RPG_AGENT_TEMPLATES.filter(a => selectedAgents.includes(a.id))
      onStart(topic.trim(), agents)
      setTopic('')
      setSelectedAgents(['wizard', 'bard', 'rogue'])
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎮 Start RPG Mode</DialogTitle>
          <DialogDescription>
            Choose your topic and assemble your AI party (max {maxAgents} agents)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Topic Input */}
          <div>
            <Label className="text-sm font-medium mb-2 block">What do you want to create?</Label>
            <Input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., A cyberpunk detective story, A fantasy RPG world, A brand identity..."
              className="w-full p-3"
            />
          </div>

          {/* Agent Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Choose Your Agents ({selectedAgents.length}/{maxAgents})
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {RPG_AGENT_TEMPLATES.map(agent => (
                <Card
                  key={agent.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedAgents.includes(agent.id)
                      ? 'ring-2 ring-primary bg-primary/5'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => toggleAgent(agent.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${agent.color}30` }}
                    >
                      {agent.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">{agent.name}</span>
                        {selectedAgents.includes(agent.id) && (
                          <span className="text-xs text-green-500">✓</span>
                        )}
                      </div>
                      <p
                        className="text-xs px-2 py-0.5 rounded inline-block mb-1"
                        style={{
                          backgroundColor: `${agent.color}20`,
                          color: agent.color
                        }}
                      >
                        {agent.class}
                      </p>
                      <p className="text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Click to select. Maximum {maxAgents} agents.
            </p>
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStart}
            disabled={!topic.trim() || selectedAgents.length === 0}
            className="w-full"
          >
            Start RPG Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface AgentCustomizerProps {
  agent: RPGAgent
  onSave: (updates: Partial<RPGAgent>) => void
  onClose: () => void
}

export function AgentCustomizer({ agent, onSave, onClose }: AgentCustomizerProps) {
  const [customName, setCustomName] = useState(agent.customName || agent.name)
  const [customPersonality, setCustomPersonality] = useState(
    agent.customPersonality || agent.personality
  )
  const [selectedAvatar, setSelectedAvatar] = useState(agent.avatar)
  const [selectedColor, setSelectedColor] = useState(agent.color)

  const handleSave = () => {
    onSave({
      customName: customName !== agent.name ? customName : undefined,
      customPersonality: customPersonality !== agent.personality ? customPersonality : undefined,
      avatar: selectedAvatar,
      color: selectedColor
    })
    onClose()
  }

  const handleReset = () => {
    setCustomName(agent.name)
    setCustomPersonality(agent.personality)
    setSelectedAvatar(agent.avatar)
    setSelectedColor(agent.color)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>⚙️ Customize Agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Avatar Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Avatar</Label>
            <div className="flex flex-wrap gap-2">
              {AGENT_AVATARS.map(avatar => (
                <button
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${
                    selectedAvatar === avatar
                      ? 'ring-2 ring-primary ring-offset-2'
                      : 'hover:scale-110'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Name</Label>
            <Input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Agent name"
            />
          </div>

          {/* Personality */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Personality</Label>
            <Textarea
              value={customPersonality}
              onChange={e => setCustomPersonality(e.target.value)}
              placeholder="Agent personality description"
              rows={3}
            />
          </div>

          {/* Color */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Color</Label>
            <div className="flex flex-wrap gap-2">
              {AGENT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === color
                      ? 'ring-2 ring-offset-2 ring-primary scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Reset
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
