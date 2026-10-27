type SavedEntry = { id: string; updatedAt?: number }

// Per-ID writes serialize across connections in one IndexedDB transaction.
// Legacy arrays are migrated in that same transaction without replacing newer rows.
export async function playgroundEntries<T extends SavedEntry>(owner: string, entry?: T): Promise<T[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('feynman-accounts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('account-data')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction('account-data', entry ? 'readwrite' : 'readonly')
      const store = transaction.objectStore('account-data')
      const prefix = `${owner}:playground:`
      const rows = new Map<string, T>()
      const legacy = store.get(`${owner}:playground`)
      legacy.onsuccess = () => {
        for (const value of (legacy.result || []) as T[]) if (value?.id) rows.set(value.id, value)
        const persisted = new Set<string>()
        const cursor = store.openCursor()
        cursor.onsuccess = () => {
          const current = cursor.result
          if (current) {
            if (String(current.key).startsWith(prefix)) { rows.set(current.value.id, current.value); persisted.add(current.value.id) }
            current.continue(); return
          }
          if (entry) {
            rows.set(entry.id, entry)
            for (const value of rows.values()) if (!persisted.has(value.id) || value.id === entry.id) store.put(value, prefix + value.id)
            store.delete(`${owner}:playground`)
          }
        }
      }
      transaction.oncomplete = () => resolve([...rows.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))
      transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Could not save this test.'))
    })
  } finally { db.close() }
}

export function subscribePlayground(owner: string, refresh: () => void) {
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`feynman-playground:${owner}`)
  if (channel) channel.onmessage = refresh
  window.addEventListener('focus', refresh)
  return () => { channel?.close(); window.removeEventListener('focus', refresh) }
}

export function notifyPlayground(owner: string) {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(`feynman-playground:${owner}`)
  channel.postMessage('saved')
  channel.close()
}
