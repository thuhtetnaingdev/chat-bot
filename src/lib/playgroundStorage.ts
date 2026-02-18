import { type PlaygroundSession } from '@/types/playground'

const DB_NAME = 'prompt_playground'
const DB_VERSION = 1
const SESSIONS_STORE = 'sessions'
const METADATA_STORE = 'metadata'
const ACTIVE_SESSION_KEY = 'activeSessionId'

let dbInstance: IDBDatabase | null = null

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open database'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE)
      }
    }
  })
}

export async function saveSession(session: PlaygroundSession): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSIONS_STORE], 'readwrite')
    const store = transaction.objectStore(SESSIONS_STORE)
    const request = store.put(session)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to save session'))
  })
}

export async function loadSession(id: string): Promise<PlaygroundSession | null> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSIONS_STORE], 'readonly')
    const store = transaction.objectStore(SESSIONS_STORE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('Failed to load session'))
  })
}

export async function loadAllSessions(): Promise<PlaygroundSession[]> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSIONS_STORE], 'readonly')
    const store = transaction.objectStore(SESSIONS_STORE)
    const request = store.getAll()

    request.onsuccess = () => {
      const sessions = request.result as PlaygroundSession[]
      sessions.sort((a, b) => b.updatedAt - a.updatedAt)
      resolve(sessions)
    }
    request.onerror = () => reject(new Error('Failed to load sessions'))
  })
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSIONS_STORE, METADATA_STORE], 'readwrite')
    const store = transaction.objectStore(SESSIONS_STORE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to delete session'))
  })
}

export async function getActiveSessionId(): Promise<string | null> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly')
    const store = transaction.objectStore(METADATA_STORE)
    const request = store.get(ACTIVE_SESSION_KEY)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('Failed to get active session ID'))
  })
}

export async function setActiveSessionId(id: string | null): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readwrite')
    const store = transaction.objectStore(METADATA_STORE)
    const request = id 
      ? store.put(id, ACTIVE_SESSION_KEY)
      : store.delete(ACTIVE_SESSION_KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to set active session ID'))
  })
}

export async function clearAllSessions(): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSIONS_STORE, METADATA_STORE], 'readwrite')
    const sessionsStore = transaction.objectStore(SESSIONS_STORE)
    const metadataStore = transaction.objectStore(METADATA_STORE)
    
    sessionsStore.clear()
    metadataStore.delete(ACTIVE_SESSION_KEY)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error('Failed to clear sessions'))
  })
}
