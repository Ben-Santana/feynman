export type QueuedMessage = { id: string; text: string }
type QueueState = { draft: string; queue?: QueuedMessage[]; queuePaused?: boolean; sending?: string }

export const queuedMessage = (text: string): QueuedMessage => ({ id: crypto.randomUUID(), text })

export function moveQueued(queue: QueuedMessage[], from: number, to: number) {
  const next = [...queue]
  const [moved] = next.splice(from, 1)
  if (moved) next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}

// An unsent message stays ahead of later ones. The queue waits so a failed
// request cannot be followed by replies to messages the learner sent after it.
export function recoverSend<T extends QueueState>(session: T, text?: string): T {
  const queue = session.queue ?? []
  const { sending: _sent, ...rest } = session
  if (!text) return { ...rest, queuePaused: queue.length > 0 } as T
  if (!session.draft && !queue.length) return { ...rest, draft: text } as T
  return { ...rest, queue: [queuedMessage(text), ...queue], queuePaused: true } as T
}

// A reload can land mid-turn, so nothing resumes until the learner asks for it.
export function restoreQueue<T extends QueueState>(session: T): T {
  const queue = (Array.isArray(session.queue) ? session.queue : []).filter(item => typeof item?.id === 'string' && typeof item.text === 'string')
  const restored = recoverSend({ ...session, queue }, session.sending)
  return { ...restored, queuePaused: Boolean(restored.queue?.length) }
}
