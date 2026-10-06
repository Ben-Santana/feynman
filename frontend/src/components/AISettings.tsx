import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { aiHeaders, aiPreferences, saveAIPreferences, type AIPreferences, type ProviderInfo } from '../aiPreferences'
import { BackButton } from './BackButton'
import './AISettings.css'

type Account = { id: string; label: string; email: string; revision: string; connected: boolean }
type Health = { configured: boolean; accounts: Account[]; pendingRegistration: boolean; anthropicConfigured: boolean; model: string }
type Model = { slug: string; name: string }
function ModelSelect({ value, disabled, onChange, children }: { value: string; disabled: boolean; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="ai-settings-field">Model
    <span className="ai-model-select">
      <select value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{children}</select>
      <svg className="ai-model-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m7 10 5 5 5-5" /></svg>
    </span>
  </label>
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.timeout(45000), headers: { ...aiHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) })
  let result
  try { result = await response.json() } catch { throw new Error('The local API returned an invalid response. Restart the app with npm run dev, then try again.') }
  if (!response.ok) throw new Error(result.error || 'Could not connect to the API. Start the app with npm run dev.')
  return result
}

export function AISettings({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState(aiPreferences)
  const [health, setHealth] = useState<Health | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [welcome, setWelcome] = useState(false)
  const pending = useRef<{ until: number; popup: Window; accountId?: string; before: Map<string, string> } | null>(null)
  const lock = useRef(false)
  const welcomeDialog = useRef<HTMLDialogElement>(null)
  const selected = health?.accounts.find(item => item.id === prefs.accountId)
  const selectedProvider = providers.find(item => item.id === prefs.provider)
  const choose = useCallback((value: AIPreferences) => {
    const previous = aiPreferences()
    if (previous.provider !== value.provider || previous.accountId !== value.accountId) setModels([])
    saveAIPreferences({ ...value, model: previous.provider !== value.provider ? '' : value.model }); setPrefs(aiPreferences()); setError(''); setNotice('')
  }, [])
  const reload = useCallback(async () => {
    const requestedPreferences = JSON.stringify(aiPreferences())
    const catalog = await request<{ providers: ProviderInfo[] }>('/api/ai/providers')
    if (requestedPreferences !== JSON.stringify(aiPreferences())) return
    setProviders(catalog.providers)
    if (!catalog.providers.some(item => item.id === aiPreferences().provider)) {
      setHealth(null)
      throw new Error('Your saved AI provider is unavailable. Choose a provider below; your selection has not been changed.')
    }
    const result = await request<Health>('/api/health')
    if (requestedPreferences !== JSON.stringify(aiPreferences())) return
    setHealth(result)
    const active = pending.current
    const newlyConnected = active && result.accounts.find(item => item.connected && item.revision !== active.before.get(item.id) && (!active.accountId || item.id === active.accountId))
    if (newlyConnected) {
      pending.current = null; setWaiting(false)
      choose({ provider: 'chatgpt', accountId: newlyConnected.id, model: '' })
      setNotice('ChatGPT connected.')
      if (!localStorage.getItem('feynman-chatgpt-welcomed')) setWelcome(true)
    } else if (aiPreferences().provider === 'chatgpt' && !aiPreferences().accountId && result.accounts.some(item => item.connected)) {
      choose({ ...aiPreferences(), accountId: result.accounts.find(item => item.connected)!.id, model: '' })
    }
    if (pending.current && (pending.current.until < Date.now() || pending.current.popup.closed)) {
      pending.current = null; setWaiting(false)
      setNotice('Sign-in ended. If you did not connect, choose Continue with ChatGPT to try again.')
    }
  }, [choose])
  useEffect(() => {
    const load = async () => { try { await reload() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load AI settings.') } }
    void load()
    const refresh = () => { void reload().catch(reason => setError(reason.message)) }
    const sync = () => { setPrefs(aiPreferences()); refresh() }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', sync) }
  }, [reload, prefs.provider, prefs.accountId, prefs.model])
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => { void reload().catch(reason => setError(reason.message)) }, 1500)
    return () => clearInterval(timer)
  }, [waiting, reload])
  useEffect(() => {
    let cancelled = false
    if (!selectedProvider?.supportsModelSelection || !selectedProvider.configured) return
    request<{ models: Model[] }>('/api/ai/models').then(result => { if (!cancelled) setModels(result.models) }).catch(reason => { if (!cancelled) setError(reason.message) })
    return () => { cancelled = true }
  }, [prefs.provider, prefs.accountId, selectedProvider?.supportsModelSelection, selectedProvider?.configured, selected?.revision])
  useEffect(() => {
    if (welcome && !welcomeDialog.current?.open) welcomeDialog.current?.showModal()
  }, [welcome])
  function dismissWelcome() { localStorage.setItem('feynman-chatgpt-welcomed', '1'); setWelcome(false); welcomeDialog.current?.close() }
  async function signIn(accountId?: string, newRegistration = false) {
    if (lock.current) return
    const popup = window.open('about:blank', '_blank')
    if (!popup) { setError('Allow popups for Feynman, then choose Continue with ChatGPT.'); return }
    popup.opener = null
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await request<{ url: string }>('/api/ai/sign-in', { ...(accountId ? { accountId } : {}), ...(newRegistration ? { newRegistration: true } : {}) })
      if (new URL(result.url).origin !== 'https://auth.openai.com') throw new Error('The API returned an invalid ChatGPT sign-in address. Please restart the app.')
      pending.current = { until: Date.now() + 600000, popup, accountId, before: new Map(health?.accounts.map(item => [item.id, item.revision])) }
      popup.location.href = result.url
      setWaiting(true)
    } catch (reason) { popup.close(); setError(reason instanceof Error ? reason.message : 'Could not start ChatGPT sign-in.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function removeAccount(account: Account) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await request<{ message: string }>('/api/ai/remove-account', { accountId: account.id })
      if (aiPreferences().accountId === account.id) {
        const remaining = health?.accounts.filter(item => item.id !== account.id) || []
        choose({ ...aiPreferences(), accountId: (remaining.find(item => item.connected) || remaining[0])?.id || '', model: '' })
      }
      await reload(); setNotice(result.message)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove account.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="ai-settings-page">
    <nav className="back-navigation" aria-label="AI settings navigation"><BackButton destination="previous page" onClick={onBack} /></nav>
    <div className="ai-settings-shell">
      <header className="ai-settings-heading"><h1>AI settings</h1><p>Choose your AI.</p></header>
      <fieldset className="ai-provider-options"><legend className="ai-visually-hidden">AI provider</legend>
        {providers.map(provider => <label key={provider.id} data-selected={prefs.provider === provider.id}><input type="radio" name="provider" value={provider.id} checked={prefs.provider === provider.id} disabled={busy || waiting} onChange={() => choose({ ...prefs, provider: provider.id })} /><span><strong>{provider.id === 'chatgpt' ? 'ChatGPT' : provider.id === 'anthropic' ? 'Claude' : provider.label}</strong><small>{provider.configurationKind === 'chatgpt' ? 'Use your plan' : 'Use an API key'}</small></span></label>)}
      </fieldset>
      {selectedProvider?.configurationKind === 'chatgpt' ? <div className="ai-connection">
        <div className="ai-connection-heading"><h2>ChatGPT</h2><span className="ai-connection-status">{selected?.connected ? 'Connected' : 'Not connected'}</span></div><p className="ai-settings-note">Uses your eligible plan’s limits.</p>
        <fieldset className="ai-account-options"><legend>Accounts</legend>
          <div className="ai-account-grid">
            {health?.accounts.map(account => <div className="ai-account-card" key={account.id} data-selected={prefs.accountId === account.id}>
              <label className="ai-account-choice">
                <input className="ai-visually-hidden" type="radio" name="chatgpt-account" value={account.id} checked={prefs.accountId === account.id} disabled={busy || waiting} onChange={() => choose({ ...prefs, accountId: account.id, model: '' })} />
                <span className="ai-account-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg></span>
                <small title={account.email}>{account.email || 'ChatGPT account'}</small>
                <span className="ai-account-state">{prefs.accountId === account.id ? 'Selected' : 'Select account'}{account.connected ? '' : ' · Signed out'}</span>
              </label>
              <button type="button" className="ai-account-remove" aria-label={`Remove ${account.email || account.label}`} title="Remove account" disabled={busy || waiting} onClick={() => void removeAccount(account)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m8 8 8 8M16 8l-8 8" /></svg></button>
            </div>)}
            <button type="button" className="ai-account-add" disabled={busy || waiting} onClick={() => void signIn(undefined, Boolean(health?.accounts.length || health?.pendingRegistration))}><span className="ai-account-avatar" aria-hidden="true">+</span><strong>Add account</strong><small>Connect with ChatGPT</small></button>
          </div>
        </fieldset>
        {selected?.connected && <><ModelSelect value={prefs.model} disabled={!models.length || busy || waiting} onChange={model => choose({ ...prefs, model })}><option value="">Account default{models[0] ? ` · ${models[0].name}` : ''}</option>{models.map(model => <option key={model.slug} value={model.slug}>{model.name}</option>)}</ModelSelect>{prefs.model && models.length > 0 && !models.some(model => model.slug === prefs.model) && <p role="alert">Your saved model is unavailable. Choose another model.</p>}</>}
        <div className="ai-settings-actions">
          {selected && !selected.connected && <button type="button" className="ai-chatgpt-button" disabled={busy || waiting} onClick={() => void signIn(selected?.id)}>Continue with ChatGPT</button>}
          <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage ↗</a>
        </div>
        {waiting && <p role="status">Finish sign-in in the browser tab, then return here. <button type="button" className="ai-secondary-button" onClick={() => { pending.current?.popup.close(); pending.current = null; setWaiting(false) }}>Cancel</button></p>}
        
      </div> : selectedProvider && <div className="ai-connection"><div className="ai-connection-heading"><h2>{selectedProvider.id === 'anthropic' ? 'Claude' : selectedProvider.label}</h2><span className="ai-connection-status">{selectedProvider.configured ? 'Ready' : 'Setup needed'}</span></div><p className="ai-settings-note">{selectedProvider.configured ? 'Billed to your API key.' : selectedProvider.configurationHelp}</p>
        {selectedProvider.configured && (selectedProvider.supportsModelSelection ? <ModelSelect value={prefs.model} disabled={!models.length || busy || waiting} onChange={model => choose({ ...prefs, model })}><option value="">Provider default</option>{models.map(model => <option key={model.slug} value={model.slug}>{model.name}</option>)}</ModelSelect> : <p>Configured model: {selectedProvider.model}</p>)}
        {selectedProvider.supportsModelSelection && prefs.model && models.length > 0 && !models.some(model => model.slug === prefs.model) && <p role="alert">Your saved model is unavailable. Choose another model.</p>}
        </div>}
      {error && <p className="chat-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <button type="button" className="send-button" onClick={onBack}>Done</button>
    </div>
    <dialog ref={welcomeDialog} className="ai-welcome" aria-labelledby="ai-welcome-title" onCancel={dismissWelcome}><h2 id="ai-welcome-title">You’re using your ChatGPT plan</h2><p>Eligible usage in Feynman uses your ChatGPT plan. Review limits and app access in your ChatGPT settings.</p><a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage ↗</a><button type="button" className="send-button" autoFocus onClick={dismissWelcome}>Got it</button></dialog>
  </section>
}
