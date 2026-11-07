import { FRUIT_FLY_MODEL, fruitFlyResponse } from './fruitFly.ts'
import { currentAccount } from './accounts.ts'

// The backend registry is authoritative; preserve unknown IDs so settings can report them.
export type AIProvider = string
export type ProviderInfo = {
  id: string; label: string; description: string
  configurationKind: 'api-key' | 'chatgpt'; configurationHelp: string; configuredMessage: string
  supportsModelSelection: boolean; capabilities: { images: boolean; pdfs: boolean }
  configured: boolean; model: string
}
export type AIPreferences = { provider: AIProvider; accountId: string; model: string }
const key = 'feynman-ai-preferences'
const storageKey = () => `${key}:${currentAccount()!.id}`
const defaults = (): AIPreferences => ({ provider: 'anthropic', accountId: '', model: '' })
export function aiPreferences(): AIPreferences {
  if (currentAccount()?.hosted !== false) return defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}')
    return { provider: typeof saved.provider === 'string' && saved.provider ? saved.provider : 'anthropic', accountId: typeof saved.accountId === 'string' ? saved.accountId : '', model: typeof saved.model === 'string' ? saved.model : '' }
  } catch { return defaults() }
}
export function saveAIPreferences(value: AIPreferences) {
  if (currentAccount()?.hosted !== false) return
  localStorage.setItem(storageKey(), JSON.stringify(value))
  window.dispatchEvent(new Event('feynman-ai-change'))
}
export function aiHeaders(): Record<string, string> {
  if (currentAccount()?.hosted !== false) return {}
  const prefs = aiPreferences()
  return { 'X-Feynman-Provider': prefs.provider, ...(prefs.accountId ? { 'X-Feynman-Account': prefs.accountId } : {}), ...(prefs.model && !fruitFlySelected() ? { 'X-Feynman-Model': prefs.model } : {}) }
}

export const fruitFlySelected = () => aiPreferences().model === FRUIT_FLY_MODEL
export function localAIResponse(path: string, body?: unknown): unknown {
  return fruitFlySelected() ? fruitFlyResponse(path, body) : undefined
}
