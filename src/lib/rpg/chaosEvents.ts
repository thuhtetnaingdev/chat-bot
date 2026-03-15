import type { ChaosEvent, RPGAgent } from '@/types/rpg'

export interface ChaosEventDefinition {
  id: string
  name: string
  description: string
  getModifier: (agents: RPGAgent[]) => string
  probability: number
}

export const CHAOS_EVENTS: ChaosEventDefinition[] = [
  {
    id: 'plot_twist',
    name: 'Plot Twist!',
    description: 'An unexpected development changes everything',
    getModifier: () => 'Introduce a major unexpected surprise or revelation',
    probability: 0.15
  },
  {
    id: 'time_warp',
    name: 'Time Warp',
    description: 'Jump to a different point in time',
    getModifier: () => 'Set the scene in a different time period (past or future)',
    probability: 0.1
  },
  {
    id: 'genre_shift',
    name: 'Genre Blender',
    description: 'Inject elements from a different genre',
    getModifier: () => {
      const genres = ['horror', 'comedy', 'noir', 'romance', 'western', 'sci-fi']
      const randomGenre = genres[Math.floor(Math.random() * genres.length)]
      return `Add ${randomGenre} elements to the story`
    },
    probability: 0.12
  },
  {
    id: 'antagonist_rises',
    name: 'Antagonist Rises',
    description: 'A new enemy or threat emerges',
    getModifier: () => 'Introduce a new antagonist or threat',
    probability: 0.12
  },
  {
    id: 'prophecy',
    name: 'The Oracle Speaks',
    description: 'A mysterious vision of the future',
    getModifier: () => 'Reveal or foreshadow future events',
    probability: 0.1
  },
  {
    id: 'alliance',
    name: 'Unexpected Alliance',
    description: 'Former enemies become allies',
    getModifier: () => 'Create an unlikely alliance or partnership',
    probability: 0.1
  },
  {
    id: 'betrayal',
    name: 'Betrayal!',
    description: 'Trust is broken',
    getModifier: () => 'Reveal a betrayal or broken trust',
    probability: 0.08
  },
  {
    id: 'power_surge',
    name: 'Power Surge',
    description: 'A character gains unexpected power',
    getModifier: () => 'Give a character unexpected abilities or power',
    probability: 0.08
  },
  {
    id: 'artifact',
    name: 'Mysterious Artifact',
    description: 'A powerful item appears',
    getModifier: () => 'Introduce a powerful or mysterious object',
    probability: 0.1
  },
  {
    id: 'silence',
    name: 'Silent Scene',
    description: 'No words, only action',
    getModifier: () => 'Describe the scene without any dialogue',
    probability: 0.05
  }
]

export function rollForChaosEvent(
  enabled: boolean,
  probability: number,
  agents: RPGAgent[]
): ChaosEvent | null {
  if (!enabled) return null
  if (Math.random() > probability) return null

  const eventDef = CHAOS_EVENTS[Math.floor(Math.random() * CHAOS_EVENTS.length)]

  const chaosEvent: ChaosEvent = {
    id: eventDef.id,
    name: eventDef.name,
    description: eventDef.description,
    effect: eventDef.getModifier(agents),
    modifier: eventDef.getModifier(agents)
  }

  return chaosEvent
}

export function getChaosEventById(id: string): ChaosEventDefinition | undefined {
  return CHAOS_EVENTS.find(e => e.id === id)
}
