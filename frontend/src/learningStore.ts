import type { LearningType } from './learningTypes.js'
import { accountSignal, requireAccount, supabase } from './accounts.ts'
import { playgroundEntries, notifyPlayground } from './playgroundStore.ts'

export type CourseAssignment = { courseId: string; courseName: string; moduleId: string }
export type SavedLearning<T> = { concepts: T[]; activeId: string | null }
export type SavedSession<T, S> = SavedLearning<T> & { id: string; title: string; updatedAt: number; started: boolean; learningType?: LearningType | null; setupStep?: 'title' | 'class-type' | 'concepts' | 'rubric'; files?: File[]; selectedTargets?: Record<string, string | null>; aiByName?: boolean; rubricInstructions?: string; assignment?: CourseAssignment; generic?: S }
export type AttachmentReference = { path: string; name: string; type: string; lastModified?: number }
export type CloudSession = { owner_id: string; id: string; title: string; document: { version: 1; session: Record<string, unknown> }; revision: number; updated_at: string }
type RecordSession = SavedSession<unknown, unknown>
type Pending = { record: RecordSession; revision: number; deleting?: boolean }
export type SaveStatus = { state: 'saved' | 'saving' | 'error' | 'conflict'; message: string; sessionId?: string }
export function createLearningStore({ client = supabase, getAccount = requireAccount, getSignal = accountSignal } = {}) {
  let owner = ''
  let ownerSignal: AbortSignal | undefined
  let revisions = new Map<string, number>()
  let pending = new Map<string, Pending>()
  let conflicts = new Set<string>()
  let knownAttachments = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let status: SaveStatus = { state: 'saved', message: 'Saved' }
  const listeners = new Set<() => void>()
  const bucket = 'learning-attachments'
  const boundary = (userId: string, signal: AbortSignal) => {
    signal.throwIfAborted()
    if (getAccount()?.id !== userId) throw new Error('The account changed. Sign in again to restore your work.')
  }
  function setStatus(next: SaveStatus) { status = next; listeners.forEach(listener => listener()) }
  function subscribeSaveStatus(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
  function getSaveStatus() { return status }
  function bindOwner() {
    const id = getAccount().id
    if (owner !== id || ownerSignal !== getSignal()) {
      ownerSignal = getSignal()
      owner = id; revisions = new Map(); pending = new Map(); conflicts = new Set(); knownAttachments = new Set(); running = undefined
      clearTimeout(timer); setStatus({ state: 'saved', message: 'Saved' })
    }
    return id
  }

  // Anonymous data stays in its original database and is never claimed.
  async function localValue<T>(key: string, value?: T, remove = false): Promise<T | undefined> {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('feynman-accounts', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('account-data')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction('account-data', value === undefined && !remove ? 'readonly' : 'readwrite')
        const store = transaction.objectStore('account-data')
        const request = remove ? store.delete(key) : value === undefined ? store.get(key) : store.put(value, key)
        transaction.oncomplete = () => resolve(value === undefined && !remove ? request.result : value)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error || new Error('Local recovery could not be saved.'))
      })
    } finally { database.close() }
  }
  async function recoveryRows(userId: string): Promise<Record<string, Pending>> { return await localValue<Record<string, Pending>>(`${userId}:recovery`) || {} }
  let recoveryQueue = Promise.resolve()
  function recover(userId: string, id: string, value?: Pending) {
    const task = recoveryQueue.catch(() => {}).then(async () => {
      const rows = await recoveryRows(userId)
      if (value) rows[id] = value
      else delete rows[id]
      await localValue(`${userId}:recovery`, rows)
    })
    recoveryQueue = task
    return task
  }
  async function loadPlayground<T>(): Promise<T[]> { return await playgroundEntries(getAccount().id) as T[] }
  async function savePlayground<T>(tests: T[]): Promise<T[]> {
    const userId = getAccount().id
    for (const test of tests) {
      const value = test as T & { id?: string }
      await playgroundEntries(userId, { ...value, id: value.id || crypto.randomUUID() })
    }
    notifyPlayground(userId)
    return await playgroundEntries(userId) as T[]
  }

  async function upload(blob: Blob, sessionId: string, userId: string, signal: AbortSignal): Promise<string> {
    const bytes = await blob.arrayBuffer()
    boundary(userId, signal)
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    const path = `${userId}/${sessionId}/${hash}`
    boundary(userId, signal)
    if (knownAttachments.has(path)) return path
    const { error } = await client().storage.from(bucket).upload(path, blob, { upsert: false, contentType: blob.type || 'application/octet-stream' })
    if (error && String('statusCode' in error ? error.statusCode : '') !== '409') throw error
    boundary(userId, signal)
    knownAttachments.add(path)
    return path
  }
  async function serialize(record: RecordSession, userId: string, signal: AbortSignal): Promise<CloudSession['document']> {
    const files: AttachmentReference[] = []
    for (const file of record.files || []) files.push({ path: await upload(file, record.id, userId, signal), name: file.name, type: file.type, lastModified: file.lastModified })
    const concepts = []
    for (const value of record.concepts) {
      const concept = value as Record<string, unknown>
      const messages = []
      for (const value of (concept.messages as Record<string, unknown>[] || [])) {
        const { boardImage, ...message } = value
        if (typeof boardImage === 'string') {
          if (!boardImage.startsWith('data:image/png;base64,')) throw new Error('Invalid whiteboard image.')
          const blob = await (await fetch(boardImage, { signal })).blob()
          messages.push({ ...message, boardAttachment: { path: await upload(blob, record.id, userId, signal), name: 'Whiteboard.png', type: 'image/png' } })
        } else messages.push(message)
      }
      concepts.push({ ...concept, messages })
    }
    return { version: 1, session: { ...record, concepts, files } }
  }
  async function download(reference: AttachmentReference, userId: string, signal: AbortSignal): Promise<Blob> {
    if (!reference?.path?.startsWith(`${userId}/`)) throw new Error('Invalid attachment reference.')
    boundary(userId, signal)
    const { data, error } = await client().storage.from(bucket).download(reference.path)
    if (error || !data) throw new Error('Could not load a saved attachment. Please retry.')
    boundary(userId, signal)
    knownAttachments.add(reference.path)
    return data
  }
  async function dataUrl(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob)
    })
  }
  async function hydrate(row: CloudSession, userId: string, signal: AbortSignal): Promise<RecordSession> {
    if (row.document?.version !== 1) throw new Error('This session uses an unsupported format.')
    const source = row.document.session
    const files = []
    for (const reference of (source.files as AttachmentReference[] || [])) files.push(new File([await download(reference, userId, signal)], reference.name, { type: reference.type, lastModified: reference.lastModified }))
    const concepts = []
    for (const value of (source.concepts as Record<string, unknown>[] || [])) {
      const messages = []
      for (const messageValue of (value.messages as Record<string, unknown>[] || [])) {
        const { boardAttachment, ...message } = messageValue
        messages.push(boardAttachment ? { ...message, boardImage: await dataUrl(await download(boardAttachment as AttachmentReference, userId, signal)) } : message)
      }
      concepts.push({ ...value, messages })
    }
    return { ...source, id: row.id, title: row.title, updatedAt: Date.parse(row.updated_at), concepts, files } as RecordSession
  }

  async function loadSessions<T, S>(): Promise<SavedSession<T, S>[]> {
    const userId = bindOwner(), signal = getSignal()
    const rows: CloudSession[] = []
    for (let from = 0; ; from += 100) {
      const { data, error } = await client().from('learning_sessions').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }).order('id').range(from, from + 99).abortSignal(signal)
      if (error) throw new Error('Could not load saved learning. Please retry.')
      rows.push(...data as CloudSession[])
      if (data.length < 100) break
    }
    const records: RecordSession[] = []
    const loadedRevisions = new Map<string, number>()
    for (const row of rows) { loadedRevisions.set(row.id, row.revision); records.push(await hydrate(row, userId, signal)); boundary(userId, signal) }
    const recovery = await recoveryRows(userId)
    boundary(userId, signal)
    revisions = loadedRevisions
    for (const [id, item] of Object.entries(recovery)) {
      pending.set(id, item)
      const index = records.findIndex(record => record.id === id)
      if (item.deleting) { if (index >= 0) records.splice(index, 1) }
      else if (index >= 0) records[index] = item.record
      else records.unshift(item.record)
      if ((revisions.get(id) || 0) !== item.revision) conflicts.add(id)
    }
    if (conflicts.size) setStatus({ state: 'conflict', sessionId: [...conflicts][0], message: 'This session changed on another device. Your local work is preserved.' })
    else if (pending.size) setStatus({ state: 'error', message: 'Unsaved work was restored. Retry saving when you’re ready.' })
    return records as SavedSession<T, S>[]
  }

  function queueSessionSave<T, S>(record: SavedSession<T, S>, immediate = false) {
    const userId = bindOwner()
    const prior = pending.get(record.id)
    const item: Pending = { record: structuredClone(record), revision: prior?.revision ?? revisions.get(record.id) ?? 0 }
    pending.set(record.id, item)
    void recover(userId, record.id, item).catch(() => setStatus({ state: 'error', message: 'Browser recovery is unavailable. Keep this page open and retry saving.' }))
    if (!conflicts.size) setStatus({ state: 'saving', message: 'Saving…' })
    clearTimeout(timer)
    timer = setTimeout(() => { void flushSessionSaves().catch(() => {}) }, immediate ? 0 : 700)
  }
  async function flushSessionSaves(): Promise<void> {
    const userId = bindOwner(), signal = getSignal()
    clearTimeout(timer)
    if (running) return running
    const queue = pending
    const task = (async () => {
      // Cloud saving can still work when browser recovery storage is unavailable.
      await recoveryQueue.catch(() => {})
      for (const [id, item] of queue) {
        boundary(userId, signal)
        if (conflicts.has(id)) continue
        const document = item.deleting ? null : await serialize(item.record, userId, signal)
        boundary(userId, signal)
        const response = item.deleting
          ? await client().rpc('delete_learning_session', { session_id: id, expected_revision: item.revision }).abortSignal(signal)
          : await client().rpc('save_learning_session', { session_id: id, session_title: item.record.title, session_document: document, expected_revision: item.revision }).abortSignal(signal).single()
        boundary(userId, signal)
        if (response.error) {
          if (response.error.code === '40001') {
            conflicts.add(id); setStatus({ state: 'conflict', sessionId: id, message: 'This session changed on another device. Your local work is preserved.' }); continue
          }
          throw new Error('Could not save your learning. Your work is preserved on this device.')
        }
        const revision = item.deleting ? 0 : (response.data as CloudSession).revision
        revisions.set(id, revision)
        if (queue.get(id) === item) { queue.delete(id); await recover(userId, id) }
        else { const latest = queue.get(id)!; latest.revision = revision; await recover(userId, id, latest); return }
      }
      if (!conflicts.size && !queue.size) setStatus({ state: 'saved', message: 'Saved' })
    })()
    running = task
    try { await task }
    catch (reason) {
      if (!signal.aborted && owner === userId) setStatus({ state: 'error', message: reason instanceof Error ? reason.message : 'Could not save. Retry when connected.' })
      throw reason
    } finally {
      if (owner === userId && running === task) {
        running = undefined
        if (!conflicts.size && pending.size && status.state === 'saving') timer = setTimeout(() => { void flushSessionSaves().catch(() => {}) }, 0)
      }
    }
  }
  async function deleteSession<T, S>(record: SavedSession<T, S>): Promise<void> {
    if (record.assignment) throw new Error('Assigned topics cannot be deleted.')
    const userId = bindOwner()
    await flushSessionSaves()
    if (conflicts.has(record.id)) throw new Error('Resolve this session’s save conflict before deleting it.')
    const revision = revisions.get(record.id) || 0
    if (!revision) { pending.delete(record.id); await recover(userId, record.id); return }
    const item: Pending = { record: record as RecordSession, revision, deleting: true }
    pending.set(record.id, item); await recover(userId, record.id, item)
    setStatus({ state: 'saving', message: 'Deleting…' })
    await flushSessionSaves()
    if (conflicts.has(record.id)) throw new Error('This session changed on another device. Resolve the conflict before deleting.')
  }
  async function resolveSessionConflict(id: string, keepCopy: boolean): Promise<RecordSession | null> {
    const userId = bindOwner(), signal = getSignal()
    const local = pending.get(id)
    if (keepCopy && local?.record.assignment) throw new Error('Assigned topics cannot be copied. Reload the server version to resolve this conflict.')
    if (keepCopy && local && !local.deleting) {
      const copy = { ...local.record, id: crypto.randomUUID(), title: `${local.record.title} (copy)`, updatedAt: Date.now() }
      boundary(userId, signal)
      // Persist the replacement before removing the original recovery draft.
      queueSessionSave(copy, true)
      await recoveryQueue
      boundary(userId, signal)
      pending.delete(id); conflicts.delete(id); await recover(userId, id)
      if (conflicts.size) setStatus({ state: 'conflict', sessionId: [...conflicts][0], message: 'Another session changed on another device.' })
      else setStatus({ state: pending.size ? 'saving' : 'saved', message: pending.size ? 'Saving…' : 'Saved' })
      return copy
    }
    const { data, error } = await client().from('learning_sessions').select('*').eq('owner_id', userId).eq('id', id).abortSignal(signal).maybeSingle()
    if (error) throw new Error('Could not load the server version. Please retry.')
    const record = data ? await hydrate(data as CloudSession, userId, signal) : null
    boundary(userId, signal)
    pending.delete(id); conflicts.delete(id); await recover(userId, id)
    if (data) revisions.set(id, data.revision); else revisions.delete(id)
    if (conflicts.size) setStatus({ state: 'conflict', sessionId: [...conflicts][0], message: 'Another session changed on another device.' })
    else setStatus({ state: pending.size ? 'saving' : 'saved', message: pending.size ? 'Saving…' : 'Saved' })
    return record
  }

  async function encodeSession<T, S>(record: SavedSession<T, S>) {
    const userId = bindOwner(), signal = getSignal()
    const document = await serialize(record as RecordSession, userId, signal)
    boundary(userId, signal)
    return document
  }
  async function decodeSession<T, S>(row: CloudSession, trackRevision = false): Promise<SavedSession<T, S>> {
    const userId = bindOwner(), signal = getSignal()
    const record = await hydrate(row, userId, signal)
    boundary(userId, signal)
    if (trackRevision) revisions.set(row.id, row.revision)
    return record as SavedSession<T, S>
  }
  async function saveModuleRecovery<T>(id: string, draft: T | null) {
    const userId = bindOwner(), signal = getSignal()
    await localValue(`${userId}:module:${id}`, draft)
    boundary(userId, signal)
  }
  async function loadModuleRecovery<T>(id: string): Promise<T | undefined> {
    const userId = bindOwner(), signal = getSignal()
    const value = await localValue<T>(`${userId}:module:${id}`)
    boundary(userId, signal)
    return value
  }
  return { saveModuleRecovery, loadModuleRecovery, encodeSession, decodeSession, loadSessions, queueSessionSave, flushSessionSaves, deleteSession, resolveSessionConflict, loadPlayground, savePlayground, subscribeSaveStatus, getSaveStatus }
}
const store = createLearningStore()
export const { saveModuleRecovery, loadModuleRecovery, encodeSession, decodeSession, loadSessions, queueSessionSave, flushSessionSaves, deleteSession, resolveSessionConflict, loadPlayground, savePlayground, subscribeSaveStatus, getSaveStatus } = store
