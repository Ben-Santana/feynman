import { useEffect, useRef, useState } from 'react'
import { accountSignal } from '../accounts'
import { loadCourse, updateCourseDetails, type Course, type EnrollmentMode } from '../courseStore'
import { useToast } from './useToast'

export function CourseEnrollmentToggle({ course, disabled, onUpdated }: { course: Course; disabled: boolean; onUpdated: (course: Course) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{ course: Course; pending: number } | null>(null)
  const lock = useRef(false)
  const returnFocus = useRef(false)
  const button = useRef<HTMLButtonElement>(null)
  const toast = useToast()
  const open = course.enrollment_mode === 'open'
  const currentLabel = open ? 'Open enrollment' : 'Approval required'
  const nextLabel = open ? 'Approval required' : 'Open enrollment'
  useEffect(() => {
    if (!busy && !confirmation && returnFocus.current) { returnFocus.current = false; button.current?.focus() }
  }, [busy, confirmation])
  async function save(current: Course, enrollment: EnrollmentMode) {
    const signal = accountSignal()
    const updated = await updateCourseDetails(current, { enrollment })
    signal.throwIfAborted()
    onUpdated(updated)
    returnFocus.current = true
    setConfirmation(null)
    toast(enrollment === 'open' ? 'Enrollment is open.' : 'Enrollment requires approval.')
  }
  async function toggle() {
    if (lock.current || disabled) return
    const signal = accountSignal()
    lock.current = true; setBusy(true); setError('')
    try {
      // Refresh requests before deciding whether opening enrollment needs a warning.
      const latest = await loadCourse(course.id)
      signal.throwIfAborted()
      if (latest.course.enrollment_mode !== course.enrollment_mode) {
        onUpdated(latest.course); toast('Enrollment changed. Try again.'); return
      }
      const pending = latest.progress.filter(student => student.status === 'pending').length
      if (!open && pending > 0) setConfirmation({ course: latest.course, pending })
      else await save(latest.course, open ? 'approval' : 'open')
    } catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not change enrollment. Please retry.') }
    finally { lock.current = false; if (!signal.aborted) setBusy(false) }
  }
  async function confirm() {
    if (!confirmation || lock.current) return
    const signal = accountSignal()
    lock.current = true; setBusy(true); setError('')
    try { await save(confirmation.course, 'open') }
    catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not open enrollment. Please retry.') }
    finally { lock.current = false; if (!signal.aborted) setBusy(false) }
  }
  return <>
    <button type="button" ref={button} className="course-enrollment-toggle" data-open={open} disabled={disabled || busy} aria-label={`${currentLabel}. Switch to ${nextLabel.toLowerCase()}`} aria-busy={busy} onClick={() => void toggle()}>
      <span className="course-enrollment-window" aria-hidden="true"><span className="course-enrollment-labels"><span>{busy ? 'Saving…' : currentLabel}</span><span>{nextLabel}</span></span></span>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="m4 6 4-4 4 4M4 10l4 4 4-4" /></svg>
    </button>
    {error && !confirmation && <span className="course-enrollment-error" role="alert">{error}</span>}
    {confirmation && <OpenEnrollmentDialog pending={confirmation.pending} busy={busy} error={error} onConfirm={() => void confirm()} onClose={() => { setConfirmation(null); setError(''); queueMicrotask(() => button.current?.focus()) }} />}
  </>
}

function OpenEnrollmentDialog({ pending, busy, error, onConfirm, onClose }: { pending: number; busy: boolean; error: string; onConfirm: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  function close() { if (!busy) { dialog.current?.close(); onClose() } }
  return <dialog ref={dialog} className="course-edit-dialog course-enrollment-dialog" aria-labelledby="course-enrollment-title" aria-describedby="course-enrollment-warning" onCancel={event => { event.preventDefault(); close() }}>
    <div className="course-edit-heading"><h2 id="course-enrollment-title">Open enrollment?</h2><button type="button" className="course-dialog-close" aria-label="Close enrollment warning" disabled={busy} onClick={close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
    <p id="course-enrollment-warning">{pending === 1 ? '1 student is waiting for approval.' : `${pending} students are waiting for approval.`} Opening enrollment admits all pending requests immediately. New students can join without approval.</p>
    {error && <p className="course-edit-error" role="alert">{error}</p>}
    <div className="course-edit-footer"><button type="button" disabled={busy} onClick={close} autoFocus>Cancel</button><button type="button" className="course-primary-action" disabled={busy} onClick={onConfirm}>{busy ? 'Opening…' : 'Open enrollment'}</button></div>
  </dialog>
}
