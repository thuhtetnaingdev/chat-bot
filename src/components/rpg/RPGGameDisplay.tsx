import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Play, Square, Save, Flag, ChevronDown, ChevronUp } from 'lucide-react'
import type { RPGGameState, RPGRound, RPGAgent } from '@/types/rpg'

interface RPGGameDisplayProps {
  gameState: RPGGameState
  round?: RPGRound
  isUserTurn: boolean
  isProcessing: boolean
  agents: RPGAgent[]
  onUserSubmit: (prompt: string) => void
  onStop: () => void
  onComplete: () => void
  onToggleChaos: (enabled: boolean) => void
  onSave?: () => void
}

function StatusBadge({ status, isProcessing }: { status: string; isProcessing: boolean }) {
  if (status === 'active' && isProcessing) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-600">
        <Loader2 className="w-3 h-3 animate-spin" />
        Working
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
        ✓ Done
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-xs px-2 py-1 rounded-full border border-border text-muted-foreground">
      Waiting
    </span>
  )
}

export function RPGGameDisplay({
  gameState,
  round,
  isUserTurn,
  isProcessing,
  agents,
  onUserSubmit,
  onStop,
  onComplete,
  onToggleChaos,
  onSave
}: RPGGameDisplayProps) {
  const [userInput, setUserInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const handleSubmit = () => {
    if (userInput.trim()) {
      onUserSubmit(userInput.trim())
      setUserInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const getAgentStatus = (agent: RPGAgent): 'active' | 'waiting' | 'completed' => {
    if (!round || !isProcessing) return 'waiting'
    if (round.agentTurns.some(t => t.agentId === agent.id)) {
      return 'completed'
    }
    const currentAgentIndex = round.agentTurns.length
    if (agents[currentAgentIndex]?.id === agent.id) {
      return 'active'
    }
    return 'waiting'
  }

  return (
    <div className="space-y-4">
      {/* Game Header */}
      <Card className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">🎮 {gameState.topic}</h3>
            <p className="text-sm text-muted-foreground">
              Round {gameState.round} • {agents.length} Agents •{' '}
              {gameState.status === 'active' ? 'Active' : 'Paused'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Chaos Events Toggle */}
            <button
              onClick={() => !isProcessing && onToggleChaos(!gameState.settings.chaosEventsEnabled)}
              disabled={isProcessing}
              className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                gameState.settings.chaosEventsEnabled
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-600'
                  : 'bg-muted border-border text-muted-foreground'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-orange-500/30'}`}
            >
              🎲 Chaos: {gameState.settings.chaosEventsEnabled ? 'ON' : 'OFF'}
            </button>
            {onSave && (
              <Button variant="outline" size="sm" onClick={onSave}>
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
            )}
            {!isProcessing && gameState.round > 0 && (
              <Button variant="outline" size="sm" onClick={onComplete}>
                <Flag className="w-4 h-4 mr-1" />
                End
              </Button>
            )}
            {isProcessing && (
              <Button variant="destructive" size="sm" onClick={onStop}>
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Agent Party */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {agents.map(agent => {
          const status = getAgentStatus(agent)
          return (
            <Card
              key={agent.id}
              className="p-3 min-w-[120px] border-2 transition-all"
              style={{
                borderColor: agent.color,
                opacity: status === 'waiting' ? 0.6 : 1
              }}
            >
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback
                    className="text-lg"
                    style={{ backgroundColor: `${agent.color}30` }}
                  >
                    {agent.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{agent.customName || agent.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{agent.class}</p>
                </div>
              </div>
              <div className="mt-2 flex justify-center">
                <StatusBadge status={status} isProcessing={isProcessing} />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Chaos Event Display */}
      {round?.chaosEvent && (
        <Card className="p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎲</span>
            <div>
              <p className="font-bold text-orange-600 dark:text-orange-400">
                Chaos Event: {round.chaosEvent.name}
              </p>
              <p className="text-sm text-muted-foreground">{round.chaosEvent.modifier}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Current Round */}
      {round && (
        <Card className="p-4">
          <h4 className="font-bold mb-3">Round {round.roundNumber}</h4>

          {/* User's Direction */}
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">User Direction:</p>
            <p className="text-sm">{round.userTurn.prompt}</p>
          </div>

          {/* Agent Contributions */}
          <ScrollArea className="h-[250px]">
            <div className="space-y-3">
              {round.agentTurns.map((turn, idx) => {
                const agent = agents.find(a => a.id === turn.agentId)
                return (
                  <div key={idx} className="flex gap-3 p-3 rounded-lg bg-card border">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback
                        className="text-lg"
                        style={{ backgroundColor: `${agent?.color}30` }}
                      >
                        {agent?.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{turn.agentName}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded capitalize"
                          style={{
                            backgroundColor: `${agent?.color}20`,
                            color: agent?.color
                          }}
                        >
                          {agent?.class}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{turn.contribution}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* User Input */}
      {isUserTurn && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-2">Your Turn:</p>
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What direction do you want to give? (e.g., 'Add a plot twist' or 'Create a mysterious character')"
            className="w-full min-h-[80px] p-3 rounded-lg border bg-background resize-none mb-3"
            disabled={isProcessing}
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!userInput.trim() || isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agents Working...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Round {gameState.round + 1}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Project Summary Toggle */}
      {gameState.context.story && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Project History ({gameState.round} rounds)
          </button>

          {showHistory && (
            <Card className="p-4">
              <ScrollArea className="h-[200px]">
                <p className="text-sm whitespace-pre-wrap">{gameState.context.story}</p>
              </ScrollArea>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
