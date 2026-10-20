export const evaluatorHistoryLimit = 40
const historyKey = 'feynman-evaluator-comparisons-v1'
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export type EvaluatorHistoryRecord = { runId: string; generatedAt: string; case: { id: string; title: string; messages: unknown[] } }

export function loadEvaluatorHistory<T extends EvaluatorHistoryRecord>(storage?: StorageAccess): { entries: T[]; notice: string } {
  try {
    const value: unknown = JSON.parse((storage ?? globalThis.localStorage).getItem(historyKey) || '[]')
    if (!Array.isArray(value)) throw new Error('Invalid history')
    const entries = value.filter(item => item && typeof item.runId === 'string' && typeof item.generatedAt === 'string' && typeof item.case?.id === 'string' && typeof item.case?.title === 'string' && Array.isArray(item.case?.messages) && item.legacy && item.refined && item.shadow) as T[]
    return { entries: entries.slice(0, evaluatorHistoryLimit), notice: entries.length === value.length ? '' : 'Some saved results could not be read.' }
  } catch { return { entries: [], notice: 'Saved evaluator results could not be loaded. Browser storage may be unavailable.' } }
}

export function saveEvaluatorHistory<T extends EvaluatorHistoryRecord>(entries: T[], storage?: StorageAccess): string {
  try {
    (storage ?? globalThis.localStorage).setItem(historyKey, JSON.stringify(entries.slice(0, evaluatorHistoryLimit)))
    return ''
  } catch { return 'Results could not be saved in this browser. They remain visible for this visit; download runs to keep them.' }
}

// Sequential requests bound provider load. Completed callbacks survive later errors/cancellation.
export async function runEvaluatorBatch<T, R>(items: T[], assess: (item: T, signal: AbortSignal) => Promise<R>, onResult: (item: T, result: R) => void, onProgress: (item: T, index: number, total: number) => void, signal: AbortSignal) {
  for (const [index, item] of items.entries()) {
    signal.throwIfAborted()
    onProgress(item, index + 1, items.length)
    const result = await assess(item, signal)
    signal.throwIfAborted()
    onResult(item, result)
  }
}
