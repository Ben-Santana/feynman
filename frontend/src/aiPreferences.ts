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
export function aiPreferences(): AIPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    return { provider: typeof saved.provider === 'string' && saved.provider ? saved.provider : 'chatgpt', accountId: typeof saved.accountId === 'string' ? saved.accountId : '', model: typeof saved.model === 'string' ? saved.model : '' }
  } catch { return { provider: 'chatgpt', accountId: '', model: '' } }
}
export function saveAIPreferences(value: AIPreferences) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event('feynman-ai-change'))
}
export function aiHeaders(): Record<string, string> {
  const prefs = aiPreferences()
  return { 'X-Feynman-Provider': prefs.provider, ...(prefs.accountId ? { 'X-Feynman-Account': prefs.accountId } : {}), ...(prefs.model ? { 'X-Feynman-Model': prefs.model } : {}) }
}
