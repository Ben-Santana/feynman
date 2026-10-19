import { useEffect, useState } from 'react'
import type { Account } from '../accounts'
import { accountSignal } from '../accounts'
import { decideEnrollment, deleteCourse, deleteModule, leaveCourse, loadCourse, loadCourses, setCoursePin, startModule, type Course, type Enrollment, type CourseModule, type ModuleSession, type ModuleProgress, type StudentProgress, type CoursePerson } from '../courseStore'
import { defaultAppearance } from '../characterAppearance'
import { Bloub } from './Bloub'
import { sessionComplete } from '../learningFlow'
import { CourseHeader } from './CourseHeader'
import { CourseCard } from './CourseCard'
import { DeleteMenu } from './DeleteMenu'
import { LoadingScreen } from './AccountLoading'
import { CourseProgressDialog, type CourseProgressSelection } from './CourseProgressDialog'
import { JoinCourseDialog } from './JoinCourseDialog'
import './CoursesPage.css'

type CourseDetail = { course: Course; enrollment?: Enrollment; modules: CourseModule[]; progress: StudentProgress[]; ownProgress: ModuleProgress[]; people: CoursePerson[] }
export function CoursesPage({ account, courseId, sessions, onNavigate, onOpenAssignment }: {
  account: Account; courseId?: string; sessions: ModuleSession[]; onNavigate: (path: string) => void; onOpenAssignment: (record: ModuleSession) => void
}) {
  const [courses, setCourses] = useState<Course[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [detail, setDetail] = useState<CourseDetail | null>(null)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [view, setView] = useState<'modules' | 'people'>('modules')
  const [progressSelection, setProgressSelection] = useState<CourseProgressSelection | null>(null)
  const instructor = account.role === 'instructor'
  useEffect(() => {
    let disposed = false
    const refresh = () => setVersion(value => value + 1)
    window.addEventListener('focus', refresh)
    queueMicrotask(() => { if (!disposed) { setLoading(true); setError('') } })
    const request = courseId ? loadCourse(courseId).then(value => {
      if (!disposed) setDetail(previous => previous && (previous.course.appearance_revision ?? 0) > (value.course.appearance_revision ?? 0) ? { ...value, course: previous.course } : value)
    }) : loadCourses().then(value => { if (!disposed) { setCourses(value.courses); setEnrollments(value.enrollments) } })
    void request.catch(reason => { if (!disposed && !accountSignal().aborted) setError(reason.message) }).finally(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true; window.removeEventListener('focus', refresh) }
  }, [courseId, version])
  async function act(action: () => Promise<void>) {
    if (busy) return
    const signal = accountSignal()
    setBusy(true); setError('')
    try { await action(); signal.throwIfAborted(); setVersion(value => value + 1) }
    catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not save changes. Please retry.') }
    finally { if (!signal.aborted) setBusy(false) }
  }
  function courseUpdated(course: Course) { setDetail(previous => previous ? { ...previous, course } : previous); setVersion(value => value + 1) }
  const canLeave = (enrollment?: Enrollment) => account.role === 'student' && (enrollment?.status === 'enrolled' || enrollment?.status === 'pending')
  const leaveLabel = (enrollment?: Enrollment) => enrollment?.status === 'pending' ? 'Cancel request' : 'Leave course'
  function leave(course: Course, enrollment?: Enrollment) {
    if (busy || !canLeave(enrollment)) return
    const message = enrollment?.status === 'pending'
      ? `Cancel your request to join “${course.name}”?`
      : `Leave “${course.name}”? You will lose access to its modules. Your saved progress will be kept, but you must rejoin to continue. Rejoining may require instructor approval.`
    if (!window.confirm(message)) return
    void act(async () => {
      const signal = accountSignal()
      await leaveCourse(course.id)
      signal.throwIfAborted()
      setCourses(previous => previous.filter(value => value.id !== course.id))
      setEnrollments(previous => previous.filter(value => value.course_id !== course.id))
      if (courseId === course.id) { setDetail(null); onNavigate('/courses') }
    })
  }
  const statusLabel = (status?: string) => status === 'pending' ? 'Pending approval' : status === 'rejected' ? 'Request rejected' : 'Enrolled'
  const ownCourse = detail?.course.instructor_id === account.id && instructor
  const pendingCount = detail?.progress.filter(student => student.status === 'pending').length ?? 0
  if (loading && (courseId ? !detail : courses.length === 0)) return <LoadingScreen label="Loading courses" />
  return <section className={`courses-page${courseId ? ' course-detail-page' : ''}`} aria-labelledby="courses-title">
    {courseId && <nav className="course-breadcrumb" aria-label="Course navigation"><button type="button" onClick={() => onNavigate('/courses')}><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 5-5 5 5 5" /></svg>Courses</button>{detail && canLeave(detail.enrollment) && <button type="button" className="course-leave-button" disabled={busy} onClick={() => leave(detail.course, detail.enrollment)}>{leaveLabel(detail.enrollment)}</button>}</nav>}
    {!courseId ? <div className="dashboard-session-heading"><h1 id="courses-title">Courses</h1>{account.role !== 'admin' && <button className="dashboard-new-session" onClick={() => instructor ? onNavigate('/courses/new') : setShowJoinDialog(true)}>{instructor ? 'Create course' : 'Join course'}</button>}</div> : detail ? <CourseHeader course={detail.course} canEdit={Boolean(ownCourse)} disabled={busy} onUpdated={courseUpdated} /> : <h1 id="courses-title">Course</h1>}
    {error && <div className="course-error" role="alert"><p>{error}</p><button onClick={() => setVersion(value => value + 1)}>Retry loading</button></div>}
    {!courseId ? <>
      {showJoinDialog && account.role === 'student' && <JoinCourseDialog onClose={() => setShowJoinDialog(false)} onJoined={enrollment => { setShowJoinDialog(false); onNavigate(`/courses/${enrollment.course_id}`) }} />}
      <div className="course-card-grid">{[...courses].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))).map(course => <CourseCard key={course.id} course={course}
        status={instructor ? course.enrollment_mode === 'open' ? 'Open enrollment' : 'Approval required' : statusLabel(enrollments.find(value => value.course_id === course.id)?.status)}
        canDelete={instructor && course.instructor_id === account.id} busy={busy} onOpen={() => onNavigate(`/courses/${course.id}`)}
        onLeave={canLeave(enrollments.find(value => value.course_id === course.id)) ? () => leave(course, enrollments.find(value => value.course_id === course.id)) : undefined}
        leaveLabel={leaveLabel(enrollments.find(value => value.course_id === course.id))}
        onPin={() => void act(async () => { await setCoursePin(course.id, !course.pinned); setCourses(previous => previous.map(value => value.id === course.id ? { ...value, pinned: !course.pinned } : value)) })}
        onDelete={() => {
          if (!window.confirm(`Delete “${course.name}”? Its modules, enrollments, and assignment conversations and progress will be permanently deleted for all students.`)) return
          void act(async () => { await deleteCourse(course.id); setCourses(previous => previous.filter(value => value.id !== course.id)) })
        }}
      />)}</div>{!courses.length && !error && <p className="course-empty">No courses yet.</p>}
    </> : detail && <>
      {!ownCourse && detail.enrollment?.status !== 'enrolled' && <p className="course-pending-notice" role="status">{detail.enrollment?.status === 'pending' ? 'Waiting for instructor approval.' : 'Your enrollment request was rejected.'}</p>}
      {(ownCourse || detail.enrollment?.status === 'enrolled') && <>
        <div className="course-content-heading">
          <div className="course-view-switch" role="group" aria-label="Course view"><button type="button" aria-pressed={view === 'modules'} onClick={() => setView('modules')}>Modules<span>{detail.modules.length}</span></button><button type="button" aria-pressed={view === 'people'} onClick={() => setView('people')}>{ownCourse ? 'Students' : 'People'}<span>{ownCourse ? detail.progress.filter(student => student.status === 'enrolled').length : detail.people.length}</span>{ownCourse && pendingCount > 0 && <span className="course-pending-count">{pendingCount} pending</span>}</button></div>
          {ownCourse && view === 'modules' && <button className="course-primary-action" disabled={busy} onClick={() => onNavigate(`/courses/${courseId}/modules/${crypto.randomUUID()}/edit?new=1`)}><span aria-hidden="true">＋</span>New module</button>}
        </div>
        {view === 'modules' ? <section aria-labelledby="course-modules-title"><h2 id="course-modules-title" className="sr-only">Modules</h2><div className="course-list">{detail.modules.map(module => {
          const session = sessions.find(value => value.assignment?.moduleId === module.id)
          const cloudProgress = detail.ownProgress?.find(value => value.moduleId === module.id)
          const started = Boolean(session || cloudProgress)
          const complete = Boolean(session && sessionComplete(session.concepts)) || cloudProgress?.complete
          const moduleCopy = <>
            <span className="course-module-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg></span>
            <span className="course-module-copy"><span className="course-row-title">{module.title || 'Untitled module'}</span><span className="course-row-meta">{module.published_at ? ownCourse ? 'Published' : complete ? 'Complete' : started ? 'In progress' : 'Not started' : 'Draft'}</span></span>
          </>
          return <DeleteMenu key={module.id} label={module.title || 'Untitled module'} action="Delete module" disabled={busy} onDelete={ownCourse ? () => {
            if (!window.confirm(`Delete “${module.title || 'Untitled module'}”? This permanently deletes the module and its student conversations and progress.`)) return
            void act(async () => {
              await deleteModule(module.id, module.revision)
              setDetail(previous => previous ? { ...previous, modules: previous.modules.filter(value => value.id !== module.id), progress: previous.progress.map(student => ({ ...student, modules: student.modules.filter(value => value.moduleId !== module.id) })) } : previous)
              setProgressSelection(null)
            })
          } : undefined}>{ownCourse && module.published_at ? <button type="button" className="course-module course-row-button" key={module.id} onClick={() => setProgressSelection({ courseId: courseId!, kind: 'module', id: module.id })}>{moduleCopy}<span className="course-row-arrow" aria-hidden="true">›</span></button> : <article className="course-module" key={module.id}>
            {moduleCopy}
            {ownCourse ? !module.published_at && <button disabled={busy} onClick={() => onNavigate(`/courses/${courseId}/modules/${module.id}/edit`)}>Edit draft</button> : <button disabled={busy} onClick={() => void act(async () => { onOpenAssignment(await startModule(module.id)) })}>{complete ? 'View summary' : started ? 'Continue' : 'Start module'}</button>}
          </article>}
          </DeleteMenu>
        })}</div>{!detail.modules.length && <div className="course-content-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6" /></svg><p>No modules yet.</p></div>}</section> : !ownCourse ? <section aria-labelledby="course-people-title"><h2 id="course-people-title" className="sr-only">People</h2>
          <ul className="course-list course-people-list">{detail.people.map(person => <li className="course-student course-person" key={person.id}>
            <span className="course-student-avatar" aria-hidden="true"><Bloub static facingForward appearance={person.appearance} /></span>
            <span className="course-student-identity"><span className="course-row-title">{person.name}</span><span className="course-row-meta">{person.role === 'instructor' ? 'Teacher' : 'Student'}{person.id === account.id ? ' · You' : ''}</span></span>
          </li>)}</ul>
        </section> : <section aria-labelledby="course-students-title"><h2 id="course-students-title" className="sr-only">Students</h2>
          {!detail.progress.length && <p className="course-empty">No enrollment requests yet.</p>}
          <div className="course-list">{detail.progress.map(student => <article className="course-student" key={student.studentId}>
            <div className="course-student-heading"><button type="button" className="course-student-open" onClick={() => setProgressSelection({ courseId: courseId!, kind: 'student', id: student.studentId })}><span className="course-student-avatar" aria-hidden="true"><Bloub static facingForward appearance={detail.people.find(person => person.id === student.studentId)?.appearance ?? defaultAppearance} /></span><span className="course-student-identity"><span className="course-row-title">{student.name}</span><span className="course-row-meta">{student.email} · {statusLabel(student.status)}</span></span><span className="course-row-arrow" aria-hidden="true">›</span></button>{student.status !== 'enrolled' && <div className="course-actions"><button disabled={busy} onClick={() => void act(async () => { await decideEnrollment(courseId!, student.studentId, 'enrolled') })}>Approve</button>{student.status === 'pending' && <button disabled={busy} onClick={() => void act(async () => { await decideEnrollment(courseId!, student.studentId, 'rejected') })}>Reject</button>}</div>}</div>
          </article>)}</div>
        </section>}
      </>}
    </>}
    {ownCourse && detail && progressSelection && progressSelection.courseId === courseId && <CourseProgressDialog key={`${progressSelection.kind}:${progressSelection.id}`} selection={progressSelection} modules={detail.modules} students={detail.progress} onClose={() => setProgressSelection(null)} />}
  </section>
}
