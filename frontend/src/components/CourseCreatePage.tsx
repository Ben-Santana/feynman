import { useEffect, useRef, useState } from 'react'
import { accountSignal, type Account } from '../accounts'
import { createCourse, type EnrollmentMode } from '../courseStore'
import { BackButton } from './BackButton'
import { SetupTitleForm } from './SetupTitleForm'
import './CourseCreatePage.css'

export function CourseCreatePage({ account, onNavigate }: { account: Account; onNavigate: (path: string) => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<EnrollmentMode>('open')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invalidName, setInvalidName] = useState(false)
  const mounted = useRef(true)
  const requestLock = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function submit() {
    if (requestLock.current) return
    if (!name.trim()) {
      setInvalidName(true); setError('Enter a course name.')
      document.getElementById('course-name')?.focus()
      return
    }
    const signal = accountSignal()
    requestLock.current = true; setSaving(true); setError('')
    try {
      const course = await createCourse(name.trim(), mode)
      signal.throwIfAborted()
      if (mounted.current) onNavigate(`/courses/${course.id}`)
    } catch (reason) {
      if (mounted.current && !signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not create the course. Please retry.')
    } finally {
      requestLock.current = false
      if (mounted.current && !signal.aborted) setSaving(false)
    }
  }

  return <main className="bg-background text-foreground">
    <nav className="back-navigation" aria-label="Course creation navigation"><BackButton destination="courses" onClick={() => onNavigate('/courses')} /></nav>
    {account.role !== 'instructor' ? <section className="courses-page"><h1>Create course</h1><p>Instructor access required.</p></section> : <section className="chat-section chat-section-setup course-create-section" aria-label="Course setup">
      <div className="chat-panel">
        <SetupTitleForm heading="Create course" headingLevel={1} inputId="course-name" inputLabel="Course name" value={name} onChange={value => { setName(value); setInvalidName(false); setError('') }} onSubmit={() => void submit()} actionLabel={saving ? 'Creating…' : 'Create course →'} placeholder="e.g. Physics 101" disabled={saving} invalid={invalidName} error={error}>
          <fieldset className="course-create-enrollment" disabled={saving}>
            <legend>Enrollment</legend>
            <label className="course-create-option"><input type="radio" name="course-enrollment" value="open" checked={mode === 'open'} onChange={() => setMode('open')} /><span><strong>Open</strong><small>Students join immediately.</small></span></label>
            <label className="course-create-option"><input type="radio" name="course-enrollment" value="approval" checked={mode === 'approval'} onChange={() => setMode('approval')} /><span><strong>Approval required</strong><small>Approve students before they can access modules.</small></span></label>
          </fieldset>
        </SetupTitleForm>
      </div>
    </section>}
  </main>
}
