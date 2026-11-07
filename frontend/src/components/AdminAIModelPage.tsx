import { useEffect, useState } from 'react'
import { accountFetch } from '../accounts'
import './AdminPage.css'
import './AISettings.css'

type ModelSettings = { model: string; defaultModel: string; models: { slug: string; name: string }[] }

async function request<T>(init: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(45_000)
  const response = await accountFetch('/api/admin/ai-model', { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not update the AI model.')
  return data
}

export function AdminAIModelPage() {
  const [settings, setSettings] = useState<ModelSettings | null>(null)
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void request<ModelSettings>({ signal: controller.signal }).then(data => {
      setSettings(data)
      setModel(data.model)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const result = await request<{ model: string }>({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      })
      setSettings(current => current && { ...current, model: result.model })
      setSaved(true)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="admin-page admin-model-page" aria-labelledby="ai-model-title"><div className="admin-shell">
    <h1 id="ai-model-title">AI model</h1>
    {settings ? <form className="ai-connection admin-model-form" onSubmit={event => { event.preventDefault(); void save() }}>
      <label className="ai-settings-field">Claude model
        <select value={model} disabled={saving} aria-describedby="ai-model-help" onChange={event => { setModel(event.target.value); setSaved(false) }}>
          <option value="">Deployment default</option>
          {settings.model && !settings.models.some(item => item.slug === settings.model) && <option value={settings.model} disabled>{settings.model} (unavailable)</option>}
          {settings.models.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </label>
      {!model && <p className="ai-settings-note">The deployment default is {settings.defaultModel}.</p>}
      <p id="ai-model-help" className="ai-settings-note">Applies to new AI requests for all users.</p>
      <div className="ai-settings-actions admin-model-actions">
        <button type="submit" disabled={saving || model === settings.model}>{saving ? 'Saving…' : 'Save model'}</button>
        {saved && <span role="status">Model saved.</span>}
      </div>
    </form> : !error && <p role="status">Loading Claude models…</p>}
    {error && <p className="account-error admin-error" role="alert">{error}</p>}
  </div></section>
}
