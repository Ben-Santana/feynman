import { useEffect, useRef, useState } from 'react'
import { accountSignal } from '../accounts'
import { courseSubjects, setCourseSharing, type Course } from '../courseStore'
import { CourseSubjectTags } from './CourseSubjectTags'

export function CourseSharingDialog({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: (course: Course) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const [subjects, setSubjects] = useState(() => courseSubjects(course))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  async function save(shared: boolean) {
    if (lock.current) return
    if (shared && !subjects.length) { setError('Choose at least one subject.'); return }
    const signal = accountSignal()
    lock.current = true; setSaving(true); setError('')
    try {
      const updated = await setCourseSharing(course, shared, subjects.length ? subjects : courseSubjects(course))
      signal.throwIfAborted()
      onSaved(updated)
    } catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not save sharing settings. Please retry.') }
    finally { lock.current = false; if (!signal.aborted) setSaving(false) }
  }
  return <dialog ref={dialog} className="course-edit-dialog course-sharing-dialog" aria-labelledby="course-sharing-title" aria-describedby="course-sharing-description" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void save(true) }} aria-busy={saving}>
      <div className="course-edit-heading"><h2 id="course-sharing-title">{course.is_public ? 'Edit sharing' : 'Make course public'}</h2><button type="button" className="course-dialog-close" aria-label="Close sharing settings" disabled={saving} onClick={onClose}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <p id="course-sharing-description">Published topics will appear in the community library. People can take personal copies without enrolling or sharing their progress with you.</p>
      <CourseSubjectTags value={subjects} onChange={value => { setSubjects(value); setError('') }} disabled={saving} />
      {error && <p className="course-edit-error" role="alert">{error}</p>}
      <div className="course-edit-footer">{course.is_public && <button type="button" disabled={saving} onClick={() => void save(false)}>Make private</button>}<button type="button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="course-primary-action" disabled={saving || !subjects.length}>{saving ? 'Saving…' : course.is_public ? 'Save changes' : 'Confirm making public'}</button></div>
    </form>
  </dialog>
}
