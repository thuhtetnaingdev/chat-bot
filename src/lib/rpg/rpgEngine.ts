import { chatWithLLM, type ChatMessage } from '@/lib/api'
import type {
  RPGAgent,
  RPGRound,
  RPGGameState,
  RPGContext,
  RPGSettings,
  ChaosEvent,
  RPGCallbacks,
  RPGElement
} from '@/types/rpg'
import { DEFAULT_RPG_SETTINGS } from '@/types/rpg'
import { rollForChaosEvent } from './chaosEvents'

export class RPGGameEngine {
  private state: RPGGameState
  private agents: RPGAgent[]
  private apiKey: string
  private callbacks?: RPGCallbacks
  private abortController?: AbortController

  constructor(
    topic: string,
    agents: RPGAgent[],
    apiKey: string,
    callbacks?: RPGCallbacks,
    settings?: Partial<RPGSettings>
  ) {
    this.state = {
      gameId: `rpg-${Date.now()}`,
      topic,
      round: 0,
      status: 'active',
      context: {
        story: '',
        elements: [],
        decisions: []
      },
      settings: { ...DEFAULT_RPG_SETTINGS, ...settings }
    }
    this.agents = agents
    this.apiKey = apiKey
    this.callbacks = callbacks
  }

  getState(): RPGGameState {
    return { ...this.state }
  }

  getAgents(): RPGAgent[] {
    return [...this.agents]
  }

  getContext(): RPGContext {
    return { ...this.state.context }
  }

  updateAgent(agentId: string, updates: Partial<RPGAgent>): void {
    const index = this.agents.findIndex(a => a.id === agentId)
    if (index !== -1) {
      this.agents[index] = { ...this.agents[index], ...updates, isCustomized: true }
    }
  }

  async startRound(userPrompt: string): Promise<RPGRound> {
    if (this.state.status !== 'active') {
      throw new Error('Game is not active')
    }

    this.state.round++
    this.callbacks?.onRoundStart?.(this.state.round)

    const round: RPGRound = {
      roundNumber: this.state.round,
      userTurn: {
        prompt: userPrompt,
        timestamp: Date.now()
      },
      chaosEvent: undefined,
      agentTurns: [],
      summary: '',
      newElements: []
    }

    this.callbacks?.onUserTurnComplete?.(userPrompt)

    const chaosEvent = rollForChaosEvent(
      this.state.settings.chaosEventsEnabled,
      this.state.settings.chaosEventProbability,
      this.agents
    )

    if (chaosEvent) {
      round.chaosEvent = chaosEvent
      this.callbacks?.onChaosEventTriggered?.(chaosEvent)
    }

    for (const agent of this.agents) {
      await this.executeAgentTurn(agent, round)
    }

    round.summary = this.generateRoundSummary(round)
    this.updateContext(round)

    this.callbacks?.onRoundComplete?.(round)
    return round
  }

  private async executeAgentTurn(agent: RPGAgent, round: RPGRound): Promise<void> {
    this.callbacks?.onAgentTurnStart?.(agent)
    this.abortController = new AbortController()

    const context = this.buildAgentContext(agent, round)

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.buildAgentSystemPrompt(agent, round.chaosEvent)
      },
      {
        role: 'user',
        content: context
      }
    ]

    let response = ''

    try {
      response = await chatWithLLM(
        messages,
        this.apiKey,
        agent.model,
        chunk => {
          this.callbacks?.onAgentChunk?.(agent, chunk)
        },
        this.abortController.signal
      )

      const contribution = this.extractContribution(response)

      const turn = {
        agentId: agent.id,
        agentName: agent.customName || agent.name,
        prompt: context,
        response,
        contribution,
        timestamp: Date.now()
      }

      round.agentTurns.push(turn)
      this.callbacks?.onAgentTurnComplete?.(agent, response)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Round cancelled')
      }
      throw error
    }
  }

  private buildAgentSystemPrompt(agent: RPGAgent, chaosEvent?: ChaosEvent): string {
    let basePrompt = `You are ${agent.customName || agent.name}, ${agent.role}.
    
Personality: ${agent.customPersonality || agent.personality}

Your job is to contribute to a collaborative creative project with other AI agents.
- Add ONE specific, creative element (2-4 sentences)
- Build on what others have created
- Stay in character
- Be concise but vivid
- Focus on: ${agent.role.toLowerCase()}`

    if (chaosEvent) {
      basePrompt += `\n\n🎲 CHAOS EVENT ACTIVE: ${chaosEvent.name}
${chaosEvent.description}
Your contribution MUST include: ${chaosEvent.modifier}`
    }

    basePrompt += `\n\nRespond in this format:
CONTRIBUTION: [Your specific creative addition - 2-4 sentences]
THINKING: [Brief explanation of your choice]`

    return basePrompt
  }

  private buildAgentContext(agent: RPGAgent, round: RPGRound): string {
    const previousRounds = this.getPreviousRoundsContext()
    const userIntent = round.userTurn.prompt

    let context = `Current Project: ${this.state.topic}

Project History:
${this.state.context.story || 'Just starting...'}

User's Direction (Round ${round.roundNumber}):
"${userIntent}"`

    if (previousRounds) {
      context += `\n\nPrevious Contributions:\n${previousRounds}`
    }

    if (round.chaosEvent) {
      context += `\n\n⚠️ CHAOS EVENT: ${round.chaosEvent.modifier}`
    }

    context += `\n\nIt's your turn to add to this project. What do you contribute as ${agent.customName || agent.name}?`

    return context
  }

  private extractContribution(response: string): string {
    const match = response.match(/CONTRIBUTION:\s*(.+?)(?=THINKING:|$)/s)
    return match ? match[1].trim() : response
  }

  private generateRoundSummary(round: RPGRound): string {
    return round.agentTurns.map(t => `${t.agentName}: ${t.contribution}`).join('\n\n')
  }

  private updateContext(round: RPGRound): void {
    const roundContent = round.agentTurns.map(t => `${t.agentName}: ${t.contribution}`).join('\n')

    this.state.context.story += `\n\n--- Round ${round.roundNumber} ---\n${round.userTurn.prompt}\n\n${roundContent}`

    round.newElements = this.extractElementsFromRound(round)
    this.state.context.elements.push(...round.newElements)
  }

  private extractElementsFromRound(round: RPGRound): RPGElement[] {
    const elements: RPGElement[] = []

    for (const turn of round.agentTurns) {
      const contribution = turn.contribution.toLowerCase()

      if (
        contribution.includes('character') ||
        contribution.includes('hero') ||
        contribution.includes('villain')
      ) {
        elements.push({
          id: `el-${Date.now()}-${Math.random()}`,
          type: 'character',
          description: turn.contribution.substring(0, 100),
          createdBy: turn.agentId,
          round: round.roundNumber
        })
      }

      if (
        contribution.includes('place') ||
        contribution.includes('city') ||
        contribution.includes('location')
      ) {
        elements.push({
          id: `el-${Date.now()}-${Math.random()}`,
          type: 'location',
          description: turn.contribution.substring(0, 100),
          createdBy: turn.agentId,
          round: round.roundNumber
        })
      }

      if (
        contribution.includes('item') ||
        contribution.includes('artifact') ||
        contribution.includes('weapon')
      ) {
        elements.push({
          id: `el-${Date.now()}-${Math.random()}`,
          type: 'item',
          description: turn.contribution.substring(0, 100),
          createdBy: turn.agentId,
          round: round.roundNumber
        })
      }
    }

    return elements
  }

  private getPreviousRoundsContext(): string {
    return this.state.context.story
  }

  stop(): void {
    this.abortController?.abort()
    this.state.status = 'paused'
  }

  pause(): void {
    this.state.status = 'paused'
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'active'
    }
  }

  complete(): void {
    this.state.status = 'completed'
    this.callbacks?.onGameComplete?.(this.state)
  }

  exportState(): RPGGameState {
    return { ...this.state }
  }
}

export function createRPGGame(
  topic: string,
  agents: RPGAgent[],
  apiKey: string,
  callbacks?: RPGCallbacks,
  settings?: Partial<RPGSettings>
): RPGGameEngine {
  return new RPGGameEngine(topic, agents, apiKey, callbacks, settings)
}
