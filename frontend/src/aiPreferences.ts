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
const storageKey = () => currentAccount() ? `${key}:${currentAccount()!.id}` : key
const defaultProvider = () => currentAccount() ? 'anthropic' : 'chatgpt'
export function aiPreferences(): AIPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}')
    return { provider: typeof saved.provider === 'string' && saved.provider ? saved.provider : defaultProvider(), accountId: typeof saved.accountId === 'string' ? saved.accountId : '', model: typeof saved.model === 'string' ? saved.model : '' }
  } catch { return { provider: defaultProvider(), accountId: '', model: '' } }
}
export function saveAIPreferences(value: AIPreferences) {
  localStorage.setItem(storageKey(), JSON.stringify(value))
  window.dispatchEvent(new Event('feynman-ai-change'))
}
export function aiHeaders(): Record<string, string> {
  const prefs = aiPreferences()
  return { 'X-Feynman-Provider': prefs.provider, ...(prefs.accountId ? { 'X-Feynman-Account': prefs.accountId } : {}), ...(prefs.model && !fruitFlySelected() ? { 'X-Feynman-Model': prefs.model } : {}) }
}

export const fruitFlySelected = () => aiPreferences().model === FRUIT_FLY_MODEL
export function localAIResponse(path: string, body?: unknown): unknown {
  return fruitFlySelected() ? fruitFlyResponse(path, body) : undefined
}
