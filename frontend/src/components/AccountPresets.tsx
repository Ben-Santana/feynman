import { useEffect, useState } from 'react'
import { accountFetch, type UserRole } from '../accounts'
import { useToast } from './useToast'

type Preset = { email: string; role: UserRole; display_name: string; created_at: string }
const roleNames: Record<UserRole, string> = { student: 'Student', instructor: 'Instructor', admin: 'Admin' }

/** Accounts an admin sets up before their owners have signed in. The setup applies at first sign-in. */
export function AccountPresets() {
  const [presets, setPresets] = useState<Preset[] | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('instructor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  useEffect(() => {
    const controller = new AbortController()
    void accountFetch('/api/admin/presets', { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setPresets(data.presets)
    }).catch(reason => { if (!controller.signal.aborted) { setPresets([]); setError(reason.message) } })
    return () => controller.abort()
  }, [])
  async function add() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await accountFetch('/api/admin/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, role }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setPresets(current => [data, ...(current ?? []).filter(item => item.email !== data.email)])
      setEmail(''); setName('')
      toast(`${data.email} is set up as ${roleNames[data.role as UserRole].toLowerCase()}.`)
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy(false) }
  }
  async function remove(preset: Preset) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await accountFetch(`/api/admin/presets/${encodeURIComponent(preset.email)}`, { method: 'DELETE' })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setPresets(current => (current ?? []).filter(item => item.email !== preset.email))
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="admin-presets" aria-labelledby="presets-title">
    <h2 id="presets-title">Set up an account in advance</h2>
    <p className="admin-presets-help">The role applies the first time this person signs in, with no approval step. Admins must use a WPI email.</p>
    <form className="admin-preset-form" onSubmit={event => { event.preventDefault(); void add() }}>
      <label><span>Email</span><input type="email" required maxLength={254} autoComplete="off" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
      <label><span>Name (optional)</span><input type="text" maxLength={100} autoComplete="off" value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <label><span>Role</span><select value={role} disabled={busy} onChange={event => setRole(event.target.value as UserRole)}><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label>
      <button type="submit" disabled={busy || !email.trim()}>{busy ? 'Saving…' : 'Set up account'}</button>
    </form>
    {error && <p className="account-error admin-error" role="alert">{error}</p>}
    {presets && presets.length > 0 && <ul className="admin-preset-list" aria-label="Accounts waiting for a first sign-in">{presets.map(preset => <li key={preset.email}>
      <div className="admin-user-identity"><strong>{preset.display_name || preset.email.split('@')[0]}</strong><span>{preset.email}</span><span className="admin-approval-status">Waiting for first sign-in</span></div>
      <span className="admin-preset-role">{roleNames[preset.role]}</span>
      <button type="button" disabled={busy} aria-label={`Remove setup for ${preset.email}`} onClick={() => void remove(preset)}>Remove</button>
    </li>)}</ul>}
  </section>
}
