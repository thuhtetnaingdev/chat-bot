export interface RPGAgent {
  id: string
  name: string
  role: string
  class: 'wizard' | 'warrior' | 'bard' | 'rogue' | 'custom'
  personality: string
  model: string
  avatar: string
  color: string
  isCustomized: boolean
  customName?: string
  customPersonality?: string
}

export interface RPGGameState {
  gameId: string
  topic: string
  round: number
  status: 'active' | 'completed' | 'paused'
  context: RPGContext
  settings: RPGSettings
}

export interface RPGContext {
  story: string
  elements: RPGElement[]
  decisions: RPGDecision[]
}

export interface RPGElement {
  id: string
  type: 'character' | 'location' | 'item' | 'plot' | 'visual' | 'conflict'
  description: string
  createdBy: string
  round: number
}

export interface RPGDecision {
  round: number
  decision: string
  impact: string
}

export interface RPGRound {
  roundNumber: number
  userTurn: RPGUserTurn
  chaosEvent?: ChaosEvent
  agentTurns: RPGAgentTurn[]
  summary: string
  newElements: RPGElement[]
}

export interface RPGUserTurn {
  prompt: string
  timestamp: number
}

export interface RPGAgentTurn {
  agentId: string
  agentName: string
  prompt: string
  response: string
  contribution: string
  timestamp: number
  thinking?: string
}

export interface RPGSettings {
  chaosEventsEnabled: boolean
  chaosEventProbability: number
  maxRounds?: number
}

export interface ChaosEvent {
  id: string
  name: string
  description: string
  effect: string
  modifier?: string
  appliedToAgent?: string
}

export interface RPGCallbacks {
  onRoundStart?: (round: number) => void
  onUserTurnComplete?: (prompt: string) => void
  onChaosEventTriggered?: (event: ChaosEvent) => void
  onAgentTurnStart?: (agent: RPGAgent) => void
  onAgentChunk?: (agent: RPGAgent, chunk: string) => void
  onAgentTurnComplete?: (agent: RPGAgent, response: string) => void
  onRoundComplete?: (round: RPGRound) => void
  onGameComplete?: (state: RPGGameState) => void
}

export interface RPGSaveData {
  gameId: string
  topic: string
  createdAt: number
  updatedAt: number
  currentRound: number
  totalRounds: number
  agents: RPGAgent[]
  completedRounds: RPGRound[]
  finalOutput?: string
  status: 'active' | 'completed' | 'paused'
}

export const DEFAULT_RPG_SETTINGS: RPGSettings = {
  chaosEventsEnabled: true,
  chaosEventProbability: 0.2,
  maxRounds: undefined
}

export const RPG_AGENT_TEMPLATES: RPGAgent[] = [
  {
    id: 'wizard',
    name: 'Wizard',
    role: 'Lore Master & World Builder',
    class: 'wizard',
    personality:
      'Knowledgeable, mystical, creates magical systems and ancient lore. Focuses on rules, history, and hidden knowledge.',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    avatar: '🧙',
    color: '#8b5cf6',
    isCustomized: false
  },
  {
    id: 'warrior',
    name: 'Warrior',
    role: 'Action & Conflict Designer',
    class: 'warrior',
    personality:
      'Bold, decisive, dynamic. Focuses on action, challenges, combat, and overcoming obstacles.',
    model: 'deepseek-ai/DeepSeek-R1',
    avatar: '⚔️',
    color: '#ef4444',
    isCustomized: false
  },
  {
    id: 'bard',
    name: 'Bard',
    role: 'Creative Storyteller',
    class: 'bard',
    personality:
      'Artistic, emotional, narrative-focused. Weaves stories, creates characters, and adds depth to the world.',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    avatar: '🎭',
    color: '#f59e0b',
    isCustomized: false
  },
  {
    id: 'rogue',
    name: 'Rogue',
    role: 'Twist & Secret Master',
    class: 'rogue',
    personality:
      'Cunning, unexpected, mysterious. Adds surprises, secrets, plot twists, and hidden elements.',
    model: 'mistralai/Mistral-Nemo',
    avatar: '🗡️',
    color: '#10b981',
    isCustomized: false
  }
]

export const AGENT_AVATARS = [
  '🧙',
  '⚔️',
  '🎭',
  '🗡️',
  '🧝',
  '🧛',
  '🧟',
  '👸',
  '🤴',
  '🦸',
  '🦹',
  '🕵️',
  '👨‍🚀',
  '👩‍🚀',
  '🤖',
  '👽',
  '🧞',
  '🧚',
  '👻',
  '💀',
  '🐲',
  '🦄',
  '🦅',
  '🐺',
  '🦊',
  '🐙',
  '🦑'
]

export const AGENT_COLORS = [
  '#8b5cf6',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#a855f7'
]
