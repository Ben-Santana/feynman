import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { accountSignal } from '../accounts'
import { CourseStarButton } from './CourseStarButton'
import { CourseCover } from './CourseCover'
import { courseSubjects, loadCourse, updateCourseDetails, type Course } from '../courseStore'
import { CourseEditDialog } from './CourseEditDialog'
import { CourseEnrollmentToggle } from './CourseEnrollmentToggle'
import { useToast } from './useToast'


export function CourseHeader({ course, canEdit, disabled, onUpdated, onStar }:  { course: Course; canEdit: boolean; disabled: boolean; onUpdated: (course: Course) => void; onStar?: () => void }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(course.name)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const lock = useRef(false)
  const titleValue = useRef(course.name)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(false)
  const ownerSignal = useRef(accountSignal())
  const finishing = useRef(false)
  const titleCourse = useRef(course)
  const titleButton = useRef<HTMLButtonElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const toast = useToast()
  const flushPendingTitle = useEffectEvent(() => { void saveTitle() })
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; clearTimeout(timer.current); flushPendingTitle() }
  }, [])
  async function saveTitle() {
    clearTimeout(timer.current)
    if (lock.current || ownerSignal.current.aborted) return
    if (titleValue.current.trim() === titleCourse.current.name) {
      if (mounted.current && finishing.current) setEditingTitle(false)
      return
    }
    const signal = ownerSignal.current
    lock.current = true
    if (mounted.current) { setSaving(true); setError('') }
    try {
      // Keep typing available during saves and write newer edits with the returned revision.
      while (titleValue.current.trim() !== titleCourse.current.name) {
        signal.throwIfAborted()
        const name = titleValue.current.trim()
        if (!name || Array.from(name).length > 120) throw new Error('Enter a course name between 1 and 120 characters.')
        const updated = await updateCourseDetails(titleCourse.current, { name })
        signal.throwIfAborted()
        titleCourse.current = updated
        if (mounted.current) onUpdated(updated)
      }
      if (mounted.current && finishing.current) setEditingTitle(false)
    } catch (reason) { if (mounted.current && !signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not save the title. Please retry.') }
    finally { lock.current = false; if (mounted.current && !signal.aborted) setSaving(false) }
  }
  function finishTitle() { finishing.current = true; void saveTitle() }
  async function retryTitle() {
    if (lock.current || ownerSignal.current.aborted) return
    const signal = ownerSignal.current
    lock.current = true; setSaving(true); setError('')
    try {
      const latest = await loadCourse(course.id)
      signal.throwIfAborted()
      titleCourse.current = latest.course
      if (mounted.current) onUpdated(latest.course)
    } catch (reason) {
      if (mounted.current && !signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not save the title. Please retry.')
      return
    } finally { lock.current = false; if (mounted.current && !signal.aborted) setSaving(false) }
    void saveTitle()
  }
  const hasBanner = course.banner?.type !== 'none'
  return <header className={`course-page-header${hasBanner ? ' has-cover' : ''}`}>
    {hasBanner && <div className="course-cover-wrap"><CourseCover banner={course.banner} imageUrl={course.bannerUrl} />
      {canEdit && <button type="button" ref={editButton} className="course-cover-edit" disabled={disabled || saving} onClick={() => setEditOpen(true)}><EditIcon />Edit banner</button>}
    </div>}
    <div className="course-title-row">
      {editingTitle ? <form className="course-inline-title" aria-label="Edit course title" onSubmit={event => { event.preventDefault(); finishTitle() }}>
        <h1 id="courses-title" className="sr-only">{course.name}</h1>
        <input aria-label="Course title" value={title} maxLength={120} autoFocus onFocus={event => { finishing.current = false; event.target.select() }} onChange={event => { const value = event.target.value; titleValue.current = value; finishing.current = false; setTitle(value); setError(''); clearTimeout(timer.current); timer.current = setTimeout(() => void saveTitle(), 600) }} onBlur={finishTitle} onKeyDown={event => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.currentTarget.blur() } }} aria-invalid={Boolean(error)} aria-describedby={error ? 'course-title-error' : undefined} />
      </form> : <h1 id="courses-title" aria-label={course.name}>{canEdit ? <button ref={titleButton} className="course-title-button" disabled={disabled} aria-label="Edit course title" title="Edit course title" onClick={() => { finishing.current = false; titleCourse.current = course; titleValue.current = course.name; setTitle(course.name); setError(''); setEditingTitle(true) }}>{course.name}<EditIcon /></button> : course.name}</h1>}
      {!hasBanner && canEdit && <button type="button" ref={editButton} className="course-header-edit" disabled={disabled || saving} onClick={() => setEditOpen(true)}><EditIcon />Edit banner</button>}
    </div>
    {saving && <p className="course-title-save-status" role="status">Saving…</p>}
    {error && <p className="course-title-error" id="course-title-error" role="alert">{error} <button type="button" disabled={saving} onClick={() => void retryTitle()}>Retry</button></p>}
    <div className="course-header-meta">{canEdit && <><span className="course-header-code">Course code <strong>{course.code}</strong><button type="button" aria-label="Copy course code" onClick={() => void navigator.clipboard.writeText(course.code).then(() => toast('Course code copied.')).catch(() => toast('Could not copy the course code.'))}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M12 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2h2" /></svg></button></span><span className="course-header-dot" aria-hidden="true">·</span><CourseEnrollmentToggle course={course} disabled={disabled || saving || editingTitle || editOpen} onUpdated={onUpdated} /></>}
      <div className="course-header-community"><span>{course.is_public ? `Public · ${courseSubjects(course).join(' · ')}` : 'Private course'}</span>{onStar && <CourseStarButton course={course} busy={disabled} onClick={onStar} />}</div>
    </div>
    {editOpen && <CourseEditDialog course={course} onClose={() => setEditOpen(false)} onSaved={updated => { onUpdated(updated); setEditOpen(false); toast('Banner saved.'); queueMicrotask(() => editButton.current?.focus()) }} />}
  </header>
}
export function EditIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12.5 3.5 4 4M3 17l4.5-1L17 6.5a2.8 2.8 0 0 0-4-4L3.5 12Z" /></svg> }
