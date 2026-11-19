import { useEffect, useRef, useState } from 'react'

/** Asks for a teacher's email. `onSubmit` rejects with the message to show. */
export function CourseTeacherDialog({ title, note, submitLabel, busyLabel, onSubmit, onClose }: {
  title: string; note: string; submitLabel: string; busyLabel: string; onSubmit: (email: string) => Promise<void>; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])

  async function submit() {
    if (lock.current || !email.trim()) return
    lock.current = true; setSaving(true); setError('')
    try { await onSubmit(email.trim()) }
    catch (reason) {
      if (!dialog.current?.isConnected) return
      setError(reason instanceof Error ? reason.message : 'Could not save changes. Please retry.'); setSaving(false)
    } finally { lock.current = false }
  }

  return <dialog ref={dialog} className="course-edit-dialog course-teacher-dialog" aria-labelledby="course-teacher-title" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={saving}>
      <div className="course-edit-heading"><h2 id="course-teacher-title">{title}</h2><button type="button" className="course-dialog-close" aria-label="Close" disabled={saving} onClick={onClose}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <label className="course-teacher-field">Teacher's email
        <input type="email" required maxLength={254} autoFocus autoComplete="off" spellCheck={false} value={email} disabled={saving} aria-describedby="course-teacher-note" onChange={event => { setEmail(event.target.value); setError('') }} />
      </label>
      <p className="course-teacher-note" id="course-teacher-note">{note}</p>
      {error && <p className="course-edit-error" role="alert">{error}</p>}
      <div className="course-edit-footer"><button type="button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="course-primary-action" disabled={saving || !email.trim()}>{saving ? busyLabel : submitLabel}</button></div>
    </form>
  </dialog>
}
