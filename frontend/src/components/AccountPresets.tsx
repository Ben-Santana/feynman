import { useEffect, useRef, useState } from 'react'
import { accountFetch, type UserRole } from '../accounts'
import { useToast } from './useToast'

type CourseOption = { id: string; name: string }
type Preset = { email: string; role: UserRole; display_name: string; created_at: string; courses: CourseOption[] }
const roleNames: Record<UserRole, string> = { student: 'Student', instructor: 'Instructor', admin: 'Admin' }
const roleOrder: UserRole[] = ['student', 'instructor', 'admin']
const maxCourses = 20

function PresetDialog({ courses, onSaved, onClose }: { courses: CourseOption[]; onSaved: (preset: Preset) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [chosen, setChosen] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const shown = courses.filter(course => course.name.toLowerCase().includes(filter.trim().toLowerCase()))

  async function submit() {
    if (lock.current || !email.trim()) return
    lock.current = true; setSaving(true); setError('')
    try {
      const response = await accountFetch('/api/admin/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, role, courses: chosen }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      onSaved(data)
    } catch (reason) {
      if (dialog.current?.isConnected) { setError(reason instanceof Error ? reason.message : 'Could not set up the account. Please retry.'); setSaving(false) }
    } finally { lock.current = false }
  }

  return <dialog ref={dialog} className="course-edit-dialog admin-preset-dialog" aria-labelledby="preset-title" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={saving}>
      <div className="course-edit-heading"><h2 id="preset-title">Set up an account</h2><button type="button" className="course-dialog-close" aria-label="Close" disabled={saving} onClick={onClose}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <p className="admin-preset-note">Applies the first time this person signs in, with no approval step.</p>
      <div className="admin-preset-fields">
        <label className="course-teacher-field">Email<input type="email" required maxLength={254} autoFocus autoComplete="off" spellCheck={false} value={email} disabled={saving} onChange={event => { setEmail(event.target.value); setError('') }} /></label>
        <label className="course-teacher-field">Name (optional)<input type="text" maxLength={100} autoComplete="off" value={name} disabled={saving} onChange={event => setName(event.target.value)} /></label>
      </div>
      <fieldset className="admin-preset-roles" disabled={saving}>
        <legend>Role</legend>
        <div>{roleOrder.map(value => <label key={value}><input type="radio" name="preset-role" value={value} checked={role === value} onChange={() => { setRole(value); setError('') }} /><span>{roleNames[value]}</span></label>)}</div>
        {role === 'admin' && <p className="admin-preset-note">Admins need a WPI email and get the role only through WPI sign-in.</p>}
      </fieldset>
      <fieldset className="admin-preset-courses" disabled={saving}>
        <legend>Courses{chosen.length > 0 && <span> · {chosen.length} chosen</span>}</legend>
        <p className="admin-preset-note">{role === 'student' ? 'Enrolled in these courses at first sign-in.' : 'Added as a teacher of these courses at first sign-in.'}</p>
        {courses.length > 6 && <input type="search" className="admin-preset-filter" placeholder="Find a course" aria-label="Find a course" value={filter} onChange={event => setFilter(event.target.value)} />}
        {courses.length ? <ul>{shown.map(course => {
          const checked = chosen.includes(course.id)
          return <li key={course.id}><label><input type="checkbox" checked={checked} disabled={!checked && chosen.length >= maxCourses} onChange={() => setChosen(current => checked ? current.filter(id => id !== course.id) : [...current, course.id])} /><span>{course.name}</span></label></li>
        })}{!shown.length && <li className="admin-preset-none">No courses match.</li>}</ul> : <p className="admin-preset-none">There are no courses yet.</p>}
      </fieldset>
      {error && <p className="course-edit-error" role="alert">{error}</p>}
      <div className="course-edit-footer"><button type="button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="course-primary-action" disabled={saving || !email.trim()}>{saving ? 'Saving…' : 'Set up account'}</button></div>
    </form>
  </dialog>
}

/** Accounts an admin sets up before their owners have signed in, and the dialog that adds one. */
export function AccountPresets({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const toast = useToast()
  useEffect(() => {
    const controller = new AbortController()
    void accountFetch('/api/admin/presets', { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setPresets(data.presets); setCourses(data.courses)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [])
  async function remove(preset: Preset) {
    if (busy) return
    setBusy(preset.email); setError('')
    try {
      const response = await accountFetch(`/api/admin/presets/${encodeURIComponent(preset.email)}`, { method: 'DELETE' })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setPresets(current => current.filter(item => item.email !== preset.email))
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  return <>
    {error && <p className="account-error admin-error" role="alert">{error}</p>}
    {presets.length > 0 && <section className="admin-presets" aria-labelledby="presets-title">
      <h2 id="presets-title">Waiting for first sign-in<span>{presets.length}</span></h2>
      <ul>{presets.map(preset => <li key={preset.email} aria-busy={busy === preset.email}>
        <div className="admin-user-identity"><strong>{preset.display_name || preset.email.split('@')[0]}</strong><span>{preset.email}</span>{preset.courses.length > 0 && <span className="admin-preset-course-names">{preset.courses.map(course => course.name).join(', ')}</span>}</div>
        <span className="admin-preset-role">{roleNames[preset.role]}</span>
        <button type="button" disabled={Boolean(busy)} aria-label={`Remove setup for ${preset.email}`} onClick={() => void remove(preset)}>Remove</button>
      </li>)}</ul>
    </section>}
    {open && <PresetDialog courses={courses} onClose={onClose} onSaved={preset => {
      setPresets(current => [preset, ...current.filter(item => item.email !== preset.email)])
      onClose()
      toast(`${preset.email} is set up as ${roleNames[preset.role].toLowerCase()}.`)
    }} />}
  </>
}
