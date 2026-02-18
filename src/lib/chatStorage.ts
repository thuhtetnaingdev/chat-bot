import { type Conversation } from '@/types'
import { compressImages } from './imageCompression'

const DB_NAME = 'chatbot_db'
const DB_VERSION = 1
const CONVERSATIONS_STORE = 'conversations'
const METADATA_STORE = 'metadata'
const ACTIVE_CONVERSATION_KEY = 'activeConversationId'
const MIGRATION_FLAG_KEY = 'migratedFromLocalStorage'

// Legacy localStorage keys
const LEGACY_CONVERSATIONS_KEY = 'chatbot_conversations'

let dbInstance: IDBDatabase | null = null

/**
 * Open or create the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create conversations store
      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        const store = db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' })
        // Index for sorting by updatedAt
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      // Create metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE)
      }
    }
  })
}

/**
 * Compress images in a conversation before storing
 */
async function compressConversationImages(conversation: Conversation): Promise<Conversation> {
  const compressedMessages = await Promise.all(
    conversation.messages.map(async (msg) => {
      const compressedMsg = { ...msg }
      
      if (msg.images && msg.images.length > 0) {
        try {
          compressedMsg.images = await compressImages(msg.images)
        } catch {
          // If compression fails, keep original
          compressedMsg.images = msg.images
        }
      }
      
      if (msg.generatedImages && msg.generatedImages.length > 0) {
        try {
          compressedMsg.generatedImages = await compressImages(msg.generatedImages)
        } catch {
          compressedMsg.generatedImages = msg.generatedImages
        }
      }
      
      // Videos remain excluded (too large)
      if (msg.generatedVideos) {
        delete compressedMsg.generatedVideos
      }
      
      return compressedMsg
    })
  )
  
  return {
    ...conversation,
    messages: compressedMessages
  }
}

/**
 * Save a single conversation
 */
export async function saveConversation(conversation: Conversation): Promise<void> {
  const db = await openDatabase()
  const compressed = await compressConversationImages(conversation)
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATIONS_STORE], 'readwrite')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.put(compressed)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to save conversation'))
  })
}

/**
 * Save multiple conversations
 */
export async function saveConversations(conversations: Conversation[]): Promise<void> {
  const db = await openDatabase()
  
  // Compress all conversations first
  const compressedConversations = await Promise.all(
    conversations.map(conv => compressConversationImages(conv))
  )
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATIONS_STORE], 'readwrite')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    
    for (const conversation of compressedConversations) {
      store.put(conversation)
    }
    
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error('Failed to save conversations'))
  })
}

/**
 * Load all conversations
 */
export async function loadConversations(): Promise<Conversation[]> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATIONS_STORE], 'readonly')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.getAll()

    request.onsuccess = () => {
      const conversations = request.result as Conversation[]
      // Sort by updatedAt descending
      conversations.sort((a, b) => b.updatedAt - a.updatedAt)
      resolve(conversations)
    }
    request.onerror = () => reject(new Error('Failed to load conversations'))
  })
}

/**
 * Load a single conversation by ID
 */
export async function loadConversation(id: string): Promise<Conversation | null> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATIONS_STORE], 'readonly')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('Failed to load conversation'))
  })
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATIONS_STORE], 'readwrite')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to delete conversation'))
  })
}

/**
 * Clear all conversations
 */
export async function clearAllConversations(): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATIONS_STORE], 'readwrite')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to clear conversations'))
  })
}

/**
 * Get active conversation ID
 */
export async function getActiveConversationId(): Promise<string | null> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly')
    const store = transaction.objectStore(METADATA_STORE)
    const request = store.get(ACTIVE_CONVERSATION_KEY)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('Failed to get active conversation ID'))
  })
}

/**
 * Set active conversation ID
 */
export async function setActiveConversationId(id: string | null): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readwrite')
    const store = transaction.objectStore(METADATA_STORE)
    const request = id 
      ? store.put(id, ACTIVE_CONVERSATION_KEY)
      : store.delete(ACTIVE_CONVERSATION_KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to set active conversation ID'))
  })
}

/**
 * Check if migration has been completed
 */
async function isMigrationComplete(): Promise<boolean> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly')
    const store = transaction.objectStore(METADATA_STORE)
    const request = store.get(MIGRATION_FLAG_KEY)

    request.onsuccess = () => resolve(request.result === true)
    request.onerror = () => reject(new Error('Failed to check migration status'))
  })
}

/**
 * Mark migration as complete
 */
async function setMigrationComplete(): Promise<void> {
  const db = await openDatabase()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readwrite')
    const store = transaction.objectStore(METADATA_STORE)
    const request = store.put(true, MIGRATION_FLAG_KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to set migration complete'))
  })
}

/**
 * Migrate conversations from localStorage to IndexedDB
 * This runs automatically on first load
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    // Check if already migrated
    const alreadyMigrated = await isMigrationComplete()
    if (alreadyMigrated) {
      return false
    }

    // Check if there's data in localStorage
    const legacyData = localStorage.getItem(LEGACY_CONVERSATIONS_KEY)
    if (!legacyData) {
      await setMigrationComplete()
      return false
    }

    // Parse legacy data
    const conversations: Conversation[] = JSON.parse(legacyData)
    if (!Array.isArray(conversations) || conversations.length === 0) {
      await setMigrationComplete()
      return false
    }

    // Migrate to IndexedDB (with image compression)
    await saveConversations(conversations)
    
    // Clear localStorage conversations (keep settings)
    localStorage.removeItem(LEGACY_CONVERSATIONS_KEY)
    
    // Mark migration complete
    await setMigrationComplete()
    
    console.log(`Migrated ${conversations.length} conversations to IndexedDB`)
    return true
  } catch (error) {
    console.error('Migration failed:', error)
    return false
  }
}

/**
 * Initialize storage - runs on app startup
 * Handles migration and returns whether IndexedDB is available
 */
export async function initializeStorage(): Promise<{
  available: boolean
  migrated: boolean
  error?: string
}> {
  try {
    // Try to open database
    await openDatabase()
    
    // Attempt migration
    const migrated = await migrateFromLocalStorage()
    
    return { available: true, migrated }
  } catch (error) {
    console.error('IndexedDB not available:', error)
    return {
      available: false,
      migrated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if IndexedDB is available (for fallback detection)
 */
export function isIndexedDBAvailable(): boolean {
  return 'indexedDB' in window
}
