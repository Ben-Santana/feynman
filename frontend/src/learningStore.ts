import type { LearningType } from './learningTypes.js'
export type SavedLearning<T> = { concepts: T[]; activeId: string | null }
export type SavedSession<T, S> = SavedLearning<T> & { id: string; title: string; updatedAt: number; started: boolean; learningType?: LearningType | null; setupStep?: 'title' | 'class-type' | 'concepts' | 'rubric'; files?: File[]; selectedTargets?: Record<string, string | null>; aiByName?: boolean; rubricInstructions?: string; generic?: S }

const databaseName = 'feynman-learning'
const storeName = 'learning'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadLearning<T>(): Promise<SavedLearning<T> | null> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get('current')
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } finally { database.close() }
}

export async function saveLearning<T>(value: SavedLearning<T>): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).put(value, 'current')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally { database.close() }
}

export async function loadSessions<T, S>(): Promise<SavedSession<T, S>[] | null> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get('sessions')
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : null)
      request.onerror = () => reject(request.error)
    })
  } finally { database.close() }
}

export async function saveSessions<T, S>(sessions: SavedSession<T, S>[]): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).put(sessions, 'sessions')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally { database.close() }
}
