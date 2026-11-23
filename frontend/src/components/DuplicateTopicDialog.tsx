import { useEffect, useRef, useState } from 'react'
import { accountSignal } from '../accounts'
import { loadCourses, type Course } from '../courseStore'
import { Select } from './Select'

/** Picks the course a copy of a topic is created in. The copy opens in the topic editor, unsaved. */
export function DuplicateTopicDialog({ currentCourse, onChoose, onClose }: { currentCourse: Course; onChoose: (courseId: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [courses, setCourses] = useState<Course[]>([currentCourse])
  const [target, setTarget] = useState(currentCourse.id)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  useEffect(() => {
    let disposed = false
    const signal = accountSignal()
    void loadCourses().then(({ courses }) => {
      if (!disposed) setCourses([currentCourse, ...courses.filter(course => course.teaching && course.id !== currentCourse.id)])
    }).catch(() => { if (!disposed && !signal.aborted) setError('Could not load your other courses. Please retry.') })
    return () => { disposed = true }
  }, [currentCourse])

  return <dialog ref={dialog} className="course-edit-dialog course-duplicate-dialog" aria-labelledby="course-duplicate-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <form onSubmit={event => { event.preventDefault(); onChoose(target) }}>
      <div className="course-edit-heading"><h2 id="course-duplicate-title">Duplicate topic</h2><button type="button" className="course-dialog-close" aria-label="Close" onClick={onClose}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <Select label="Course" value={target} options={courses.map(course => ({ value: course.id, label: course.name }))} onChange={setTarget} />
      {error && <p className="course-edit-error" role="alert">{error}</p>}
      <div className="course-edit-footer"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="course-primary-action">Continue</button></div>
    </form>
  </dialog>
}
