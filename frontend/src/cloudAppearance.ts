import { accountSignal, requireAccount, supabase } from './accounts.ts'
import { normalizeAppearance, type CharacterAppearance } from './characterAppearance.ts'

export function createAppearanceStore({ client = supabase, getAccount = requireAccount, getSignal = accountSignal, saveDelay = 400 } = {}) {
  type PendingSave = {
    appearance: CharacterAppearance
    resolve: (appearance: CharacterAppearance) => void
    reject: (reason: unknown) => void
  }
  type SaveQueue = { signal: AbortSignal; pending: PendingSave[]; saving: boolean; timer?: ReturnType<typeof setTimeout> }
  const queues = new Map<string, SaveQueue>()

  async function flush(id: string, queue: SaveQueue) {
    if (queue.saving) return
    queue.saving = true
    try {
      while (queue.pending.length) {
        const batch = queue.pending.splice(0)
        const normalized = batch[batch.length - 1].appearance
        try {
          queue.signal.throwIfAborted()
          const { error } = await client().from('user_customizations').upsert({ user_id: id, appearance: normalized }, { onConflict: 'user_id' }).abortSignal(queue.signal)
          queue.signal.throwIfAborted()
          if (error) throw new Error('Could not save customization. Your draft is preserved; please retry.')
          // A completed request must never clear a newer draft's recovery copy.
          const key = `feynman:${id}:appearance-recovery`
          if (!queue.pending.length && localStorage.getItem(key) === JSON.stringify(normalized)) localStorage.removeItem(key)
          batch.forEach(item => item.resolve(normalized))
        } catch (reason) {
          batch.forEach(item => item.reject(reason))
        }
      }
    } finally {
      queue.saving = false
      if (queues.get(id) === queue) queues.delete(id)
    }
  }

  async function loadCloudAppearance(): Promise<{ appearance: CharacterAppearance; pending: boolean }> {
    const id = getAccount().id, signal = getSignal()
    const { data, error } = await client().from('user_customizations').select('appearance').eq('user_id', id).abortSignal(signal).maybeSingle()
    signal.throwIfAborted()
    if (error) throw new Error('Could not load your classmate customization. Please retry.')
    const recovery = localStorage.getItem(`feynman:${id}:appearance-recovery`)
    let draft: unknown
    try { draft = recovery ? JSON.parse(recovery) : null } catch { draft = null }
    return { appearance: normalizeAppearance(draft || data?.appearance), pending: Boolean(draft) }
  }
  async function saveCloudAppearance(appearance: CharacterAppearance): Promise<CharacterAppearance> {
    const id = getAccount().id, signal = getSignal()
    signal.throwIfAborted()
    const normalized = normalizeAppearance(appearance)
    localStorage.setItem(`feynman:${id}:appearance-recovery`, JSON.stringify(normalized))
    let queue = queues.get(id)
    if (!queue || queue.signal !== signal) {
      queue = { signal, pending: [], saving: false }
      queues.set(id, queue)
    }
    const current = queue
    return new Promise((resolve, reject) => {
      current.pending.push({ appearance: normalized, resolve, reject })
      if (current.saving) return
      clearTimeout(current.timer)
      current.timer = setTimeout(() => { void flush(id, current) }, saveDelay)
    })
  }

  return { loadCloudAppearance, saveCloudAppearance }
}
export const { loadCloudAppearance, saveCloudAppearance } = createAppearanceStore()
