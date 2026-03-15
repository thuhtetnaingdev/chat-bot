import type { RPGSaveData, RPGAgent, RPGElement, RPGDecision, RPGRound } from '@/types/rpg'

const DB_NAME = 'chatbot_rpg_db'
const DB_VERSION = 1
const STORE_NAME = 'rpgGames'

let dbInstance: IDBDatabase | null = null

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open RPG database'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'gameId' })
        store.createIndex('by-updated', 'updatedAt')
        store.createIndex('by-status', 'status')
      }
    }
  })
}

export async function saveRPGSaveData(gameData: RPGSaveData): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    gameData.updatedAt = Date.now()
    const request = store.put(gameData)

    request.onerror = () => reject(new Error('Failed to save RPG game'))
    request.onsuccess = () => resolve()
  })
}

export async function loadRPGSaveData(gameId: string): Promise<RPGSaveData | undefined> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(gameId)

    request.onerror = () => reject(new Error('Failed to load RPG game'))
    request.onsuccess = () => resolve(request.result)
  })
}

export async function loadAllRPGSaveData(): Promise<RPGSaveData[]> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(new Error('Failed to load RPG games'))
    request.onsuccess = () => {
      const results = request.result.sort((a, b) => b.updatedAt - a.updatedAt)
      resolve(results)
    }
  })
}

export async function loadActiveRPGSaveData(): Promise<RPGSaveData[]> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('by-status')
    const request = index.getAll('active')

    request.onerror = () => reject(new Error('Failed to load active RPG games'))
    request.onsuccess = () => resolve(request.result)
  })
}

export async function deleteRPGSaveData(gameId: string): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(gameId)

    request.onerror = () => reject(new Error('Failed to delete RPG game'))
    request.onsuccess = () => resolve()
  })
}

export async function updateRPGSaveData(
  gameId: string,
  updates: Partial<RPGSaveData>
): Promise<void> {
  const existing = await loadRPGSaveData(gameId)
  if (existing) {
    await saveRPGSaveData({ ...existing, ...updates, updatedAt: Date.now() })
  }
}

export function createRPGSaveData(
  topic: string,
  agents: {
    id: string
    name: string
    role: string
    class: string
    personality: string
    model: string
    avatar: string
    color: string
    isCustomized: boolean
  }[]
): RPGSaveData {
  const now = Date.now()
  return {
    gameId: `rpg-${now}`,
    topic,
    createdAt: now,
    updatedAt: now,
    currentRound: 0,
    totalRounds: 0,
    agents: agents as RPGAgent[],
    completedRounds: [],
    status: 'active'
  }
}

export function gameStateToSaveData(
  state: {
    gameId: string
    topic: string
    round: number
    status: string
    context: { story: string; elements: RPGElement[]; decisions: RPGDecision[] }
  },
  agents: RPGAgent[],
  completedRounds: RPGRound[]
): RPGSaveData {
  return {
    gameId: state.gameId,
    topic: state.topic,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentRound: state.round,
    totalRounds: state.round,
    agents,
    completedRounds,
    status: state.status as RPGSaveData['status'],
    finalOutput: state.context.story
  }
}

export async function exportToMarkdown(gameData: RPGSaveData): Promise<string> {
  let markdown = `# ${gameData.topic}\n\n`
  markdown += `*RPG Session - ${gameData.completedRounds?.length || 0} rounds*\n\n`
  markdown += `## Agents\n\n`
  for (const agent of gameData.agents || []) {
    markdown += `- ${agent.avatar} ${agent.customName || agent.name} (${agent.class})\n`
  }
  markdown += `\n## Story\n\n`
  markdown += gameData.finalOutput || 'No content yet.'
  markdown += `\n\n---\n*Exported from Chat Bot RPG*`

  return markdown
}

export async function exportToText(gameData: RPGSaveData): Promise<string> {
  let text = `${gameData.topic.toUpperCase()}\n`
  text += `${'='.repeat(40)}\n\n`
  text += `Agents: ${(gameData.agents || []).map((a: RPGAgent) => a.customName || a.name).join(', ')}\n`
  text += `Rounds: ${gameData.completedRounds?.length || 0}\n\n`
  text += `${gameData.finalOutput || 'No content yet.'}\n`

  return text
}
