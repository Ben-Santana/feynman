import { Fragment, useEffect, useState } from 'react'
import type { Account } from '../accounts'
import { accountSignal } from '../accounts'
import { canTeachCourses } from '../coursePermissions'
import { COMMUNITY_LIBRARY_ENABLED } from '../features'
import { decideEnrollment, deleteCourse, deleteModule, leaveCourse, loadCourse, loadCourses, setCoursePin, setCourseStar, startModule, courseSubjects, COURSE_SUBJECTS, type CourseCollection, type Course, type Enrollment, type CourseModule, type ModuleSession, type ModuleProgress, type StudentProgress, type CoursePerson } from '../courseStore'
import { createCourseStarUpdates } from '../courseStars'
import { useConfirm } from './useConfirm'
import { useToast } from './useToast'
import { defaultAppearance } from '../characterAppearance'
import { Bloub } from './Bloub'
import { sessionComplete } from '../learningFlow'
import { CourseHeader } from './CourseHeader'
import { CourseCard } from './CourseCard'
import { CourseScores } from './CourseScores'
import { formatScore } from '../courseScores'
import { DeleteMenu } from './DeleteMenu'
import { LoadingScreen } from './AccountLoading'
import { CourseProgressDialog, type CourseProgressSelection } from './CourseProgressDialog'
import { JoinCourseDialog } from './JoinCourseDialog'
import { LibraryEmptyState } from './LibraryEmptyState'
import { CollectionAddButton, CollectionSearch } from './CollectionSearch'
import './CoursesPage.css'

type CourseDetail = { course: Course; enrollment?: Enrollment; modules: CourseModule[]; progress: StudentProgress[]; ownProgress: ModuleProgress[]; people: CoursePerson[] }
export function CoursesPage({ account, courseId, collection = 'enrolled', sessions, onNavigate, onOpenAssignment, onBeforeTopic }: {
  onBeforeTopic: () => Promise<boolean>; account: Account; courseId?: string; collection?: CourseCollection; sessions: ModuleSession[]; onNavigate: (path: string) => void; onOpenAssignment: (record: ModuleSession) => void
}) {
  const [subjects, setSubjects] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [detail, setDetail] = useState<CourseDetail | null>(null)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [view, setView] = useState<'modules' | 'complete' | 'scores' | 'people'>('modules')
  const [progressSelection, setProgressSelection] = useState<CourseProgressSelection | null>(null)
  const toast = useToast()
  const confirm = useConfirm()
  const [starUpdates] = useState(() => {
    const signal = accountSignal()
    return createCourseStarUpdates((id, starred) => {
      signal.throwIfAborted()
      return setCourseStar(id, starred)
    }, (id, state) => {
      if (signal.aborted) return
      setCourses(previous => previous.map(course => course.id === id ? { ...course, ...state } : course))
      setDetail(previous => previous?.course.id === id ? { ...previous, course: { ...previous.course, ...state } } : previous)
    }, reason => {
      if (!signal.aborted) toast(reason instanceof Error ? reason.message : 'Could not save the star. Please retry.')
    })
  })
  useEffect(() => { starUpdates.setActive(true); return () => { starUpdates.setActive(false) } }, [starUpdates])
  const instructor = canTeachCourses(account.role)
  useEffect(() => {
    let disposed = false
    const refresh = () => setVersion(value => value + 1)
    window.addEventListener('focus', refresh)
    queueMicrotask(() => { if (!disposed) { setLoading(true); setError('') } })
    const starVersion = starUpdates.version
    function reconcileStars(loaded: Course, current?: Course) {
      const course = current && starVersion !== starUpdates.version ? { ...loaded, starred: current.starred, star_count: current.star_count } : loaded
      return starUpdates.overlay(course)
    }
    const request = courseId ? loadCourse(courseId).then(value => {
      if (!disposed) setDetail(previous => ({ ...value, course: reconcileStars(previous && (previous.course.appearance_revision ?? 0) > (value.course.appearance_revision ?? 0) ? previous.course : value.course, previous?.course) }))
    }) : loadCourses().then(value => { if (!disposed) { setCourses(previous => value.courses.map(course => reconcileStars(course, previous.find(current => current.id === course.id)))); setEnrollments(value.enrollments) } })
    void request.catch(reason => { if (!disposed && !accountSignal().aborted) setError(reason.message) }).finally(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true; window.removeEventListener('focus', refresh) }
  }, [courseId, version, starUpdates])
  async function act(action: () => Promise<void>) {
    if (busy) return
    const signal = accountSignal()
    setBusy(true); setError('')
    try { await action(); signal.throwIfAborted(); setVersion(value => value + 1) }
    catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not save changes. Please retry.') }
    finally { if (!signal.aborted) setBusy(false) }
  }
  function courseUpdated(course: Course) { setCourses(previous => previous.map(value => value.id === course.id ? { ...value, ...course } : value)); setDetail(previous => previous ? { ...previous, course: { ...previous.course, ...course } } : previous); setVersion(value => value + 1) }
  const canLeave = (enrollment?: Enrollment) => account.role === 'student' && (enrollment?.status === 'enrolled' || enrollment?.status === 'pending')
  const leaveLabel = (enrollment?: Enrollment) => enrollment?.status === 'pending' ? 'Cancel request' : 'Leave course'
  async function leave(course: Course, enrollment?: Enrollment) {
    if (busy || !canLeave(enrollment)) return
    const pending = enrollment?.status === 'pending'
    if (!await confirm(pending
      ? { title: 'Cancel request?', description: `Your request to join “${course.name}” will be withdrawn.`, confirmLabel: 'Hold to cancel request' }
      : { title: `Leave “${course.name}”?`, description: `Your assignment progress will be kept, but you must rejoin to continue assignments. Rejoining may require instructor approval.${COMMUNITY_LIBRARY_ENABLED && course.is_public ? ' You can still take personal copies of its public topics.' : ''}`, confirmLabel: 'Hold to leave' })) return
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
  const member = Boolean(ownCourse || detail?.enrollment?.status === 'enrolled')
  const publicCourse = COMMUNITY_LIBRARY_ENABLED && Boolean(detail?.course.is_public)
  const activeView = (view === 'scores' && !ownCourse) || (view === 'complete' && ownCourse) || (view === 'people' && !member) ? 'modules' : view
  function moduleState(current: CourseDetail, module: CourseModule) {
    const cloudProgress = current.ownProgress?.find(value => value.moduleId === module.id)
    const session = sessions.find(value => value.id === cloudProgress?.sessionId)
    return { started: Boolean(session || cloudProgress), complete: Boolean(session && sessionComplete(session.concepts)) || Boolean(cloudProgress?.complete), score: cloudProgress?.score ?? null }
  }
  const publishedModules = detail?.modules.filter(module => module.published_at) ?? []
  const completeModules = detail ? publishedModules.filter(module => moduleState(detail, module).complete) : []
  const inProgressModules = detail ? publishedModules.filter(module => !moduleState(detail, module).complete && moduleState(detail, module).started) : []
  const notStartedModules = detail ? publishedModules.filter(module => !moduleState(detail, module).started) : []
  const todoCount = inProgressModules.length + notStartedModules.length
  const moduleGroups = (ownCourse ? [publishedModules, detail?.modules.filter(module => !module.published_at) ?? []] : activeView === 'complete' ? [completeModules] : [inProgressModules, notStartedModules]).filter(group => group.length)
  const moduleHeading = ownCourse ? 'Topics' : activeView === 'complete' ? 'Complete' : 'Todo'
  const emptyTopics = !ownCourse && activeView === 'complete' ? 'No completed topics yet.' : !ownCourse && completeModules.length ? 'All topics complete.' : 'No topics yet.'
  function moduleRow(current: CourseDetail, module: CourseModule) {
    const { started, complete, score } = moduleState(current, module)
    const moduleCopy = <>
      <span className="course-module-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg></span>
      <span className="course-module-copy"><span className="course-row-title">{module.title || 'Untitled topic'}</span><span className="course-row-meta">{module.published_at ? ownCourse ? 'Published' : complete ? score === null ? 'Complete' : `Score: ${formatScore(score)}` : started ? 'In progress' : 'Not started' : 'Draft'}</span></span>
    </>
    return <DeleteMenu key={module.id} label={module.title || 'Untitled topic'} action="Delete topic" disabled={busy} onDelete={ownCourse ? async () => {
      if (!await confirm({ title: `Delete “${module.title || 'Untitled topic'}”?`, description: 'This permanently deletes the topic and its student conversations and progress.', confirmLabel: 'Hold to delete' })) return
      void act(async () => {
        await deleteModule(module.id, module.revision)
        setDetail(previous => previous ? { ...previous, modules: previous.modules.filter(value => value.id !== module.id), progress: previous.progress.map(student => ({ ...student, modules: student.modules.filter(value => value.moduleId !== module.id) })) } : previous)
        setProgressSelection(null)
      })
    } : undefined}>{ownCourse && module.published_at ? <button type="button" className="course-module course-row-button" key={module.id} onClick={() => setProgressSelection({ courseId: courseId!, kind: 'module', id: module.id })}>{moduleCopy}<span className="course-row-arrow" aria-hidden="true">›</span></button> : <article className="course-module" key={module.id}>
      {moduleCopy}
      {ownCourse ? !module.published_at && <button disabled={busy} onClick={() => onNavigate(`/courses/${courseId}/modules/${module.id}/edit`)}>Edit draft</button> : <button disabled={busy} onClick={() => void act(async () => { if (!complete && !await onBeforeTopic()) return; onOpenAssignment(await startModule(module.id, !member)) })}>{complete ? 'View summary' : started ? 'Continue' : 'Teach topic'}</button>}
    </article>}
    </DeleteMenu>
  }
  const visibleCourses = courses.filter(course => collection === 'community' ? course.is_public : course.instructor_id === account.id || enrollments.some(enrollment => enrollment.course_id === course.id))
    .filter(course => (!subjects.length || subjects.some(subject => courseSubjects(course).includes(subject))) && course.name.toLowerCase().includes(search.trim().toLowerCase()))
  visibleCourses.sort((a, b) => {
    if (collection === 'community' && Boolean(a.starred) !== Boolean(b.starred)) {
      return Number(Boolean(b.starred)) - Number(Boolean(a.starred))
    }
    return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
  })
  if (loading && (courseId ? !detail : courses.length === 0)) return <LoadingScreen label="Loading courses" />
  return <section className={`courses-page${courseId ? ' course-detail-page' : ' course-library-page'}`} aria-labelledby="courses-title">
    {courseId && <nav className="course-breadcrumb" aria-label="Course navigation"><button type="button" onClick={() => onNavigate('/courses')}><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 5-5 5 5 5" /></svg>Courses</button>{detail && canLeave(detail.enrollment) && <button type="button" className="course-leave-button" disabled={busy} onClick={() => leave(detail.course, detail.enrollment)}>{leaveLabel(detail.enrollment)}</button>}</nav>}
    {!courseId ? <h1 id="courses-title" className="sr-only">{collection === 'community' ? 'Community' : 'My Courses'}</h1> : detail ? <CourseHeader course={detail.course} canEdit={Boolean(ownCourse)} disabled={busy} onUpdated={courseUpdated} onStar={() => starUpdates.toggle(detail.course)} /> : <h1 id="courses-title">Course</h1>}
    {error && <div className="course-error" role="alert"><p>{error}</p><button onClick={() => setVersion(value => value + 1)}>Retry loading</button></div>}
    {!courseId ? <>
      {showJoinDialog && account.role === 'student' && <JoinCourseDialog onClose={() => setShowJoinDialog(false)} onJoined={enrollment => { setShowJoinDialog(false); onNavigate(`/courses/${enrollment.course_id}`) }} />}
      <div className="course-library-toolbar collection-toolbar">
        <CollectionSearch label="Search courses" value={search} onChange={setSearch} filters={COMMUNITY_LIBRARY_ENABLED ? {
          label: 'Subject', options: COURSE_SUBJECTS, selected: subjects,
          onToggle: subject => setSubjects(previous => previous.includes(subject) ? previous.filter(value => value !== subject) : [...previous, subject]),
        } : undefined} />
        <CollectionAddButton label={instructor ? 'Create course' : 'Join course'} text={instructor ? 'Create' : 'Join'} onClick={() => instructor ? onNavigate('/courses/new') : setShowJoinDialog(true)} />
      </div>
      <div className="course-card-grid">{visibleCourses.map(course => <CourseCard key={course.id} course={course}
        status={course.instructor_id === account.id ? 'Teaching' : enrollments.some(value => value.course_id === course.id) ? statusLabel(enrollments.find(value => value.course_id === course.id)?.status) : 'Public course'}
        onStar={collection === 'enrolled' ? undefined : () => starUpdates.toggle(course)}
        onSharingUpdated={COMMUNITY_LIBRARY_ENABLED && instructor && course.instructor_id === account.id ? courseUpdated : undefined}
        canDelete={instructor && course.instructor_id === account.id} busy={busy} onOpen={() => onNavigate(`/courses/${course.id}`)}
        onLeave={canLeave(enrollments.find(value => value.course_id === course.id)) ? () => void leave(course, enrollments.find(value => value.course_id === course.id)) : undefined}
        leaveLabel={leaveLabel(enrollments.find(value => value.course_id === course.id))}
        onPin={() => void act(async () => { await setCoursePin(course.id, !course.pinned); setCourses(previous => previous.map(value => value.id === course.id ? { ...value, pinned: !course.pinned } : value)) })}
        onDelete={async () => {
          if (!await confirm({ title: `Delete “${course.name}”?`, description: 'Its topics, enrollments, and assignment conversations and progress will be permanently deleted for all students.', confirmLabel: 'Hold to delete' })) return
          void act(async () => { await deleteCourse(course.id); setCourses(previous => previous.filter(value => value.id !== course.id)) })
        }}
      />)}</div>{!visibleCourses.length && !error && <LibraryEmptyState
        kind="courses"
        title={search.trim() || subjects.length ? 'No matching courses' : collection === 'community' ? 'No public courses yet' : 'No courses yet'}
        description={search.trim() || subjects.length ? 'Try a different search or subject.' : undefined}
        action={search.trim() || subjects.length ? { label: 'Clear filters', onClick: () => { setSearch(''); setSubjects([]) } } : instructor ? { label: 'Create course', onClick: () => onNavigate('/courses/new') } : collection === 'enrolled' && account.role === 'student' ? { label: 'Join course', onClick: () => setShowJoinDialog(true) } : undefined}
      />}
    </> : detail && <>
      {!member && publicCourse && <p className="course-pending-notice">Taking a topic creates a personal copy. You are not enrolled, and the teacher cannot see your progress.</p>}
      {!publicCourse && !ownCourse && detail.enrollment?.status !== 'enrolled' && <p className="course-pending-notice" role="status">{detail.enrollment?.status === 'pending' ? 'Waiting for instructor approval.' : 'Your enrollment request was rejected.'}</p>}
      {(member || publicCourse) && <>
        <div className="course-content-heading">
          <div className="course-view-switch" role="group" aria-label="Course view"><button type="button" aria-pressed={activeView === 'modules'} onClick={() => setView('modules')}>{ownCourse ? 'Topics' : 'Todo'}<span>{ownCourse ? detail.modules.length : todoCount}</span></button>{ownCourse ? <button type="button" aria-pressed={activeView === 'scores'} onClick={() => setView('scores')}>Scores</button> : <button type="button" aria-pressed={activeView === 'complete'} onClick={() => setView('complete')}>Complete<span>{completeModules.length}</span></button>}{member && <button type="button" aria-pressed={activeView === 'people'} onClick={() => setView('people')}>People<span>{ownCourse ? detail.progress.filter(student => student.status === 'enrolled').length : detail.people.length}</span>{ownCourse && pendingCount > 0 && <span className="course-pending-count">{pendingCount} pending</span>}</button>}</div>
          {ownCourse && activeView === 'modules' && <CollectionAddButton label="New topic" disabled={busy} onClick={() => onNavigate(`/courses/${courseId}/modules/${crypto.randomUUID()}/edit?new=1`)} />}
        </div>
        {activeView === 'scores' ? <section aria-labelledby="course-scores-title"><h2 id="course-scores-title" className="sr-only">Scores</h2><CourseScores modules={detail.modules} students={detail.progress} onOpenTopic={id => setProgressSelection({ courseId: courseId!, kind: 'module', id })} onOpenStudent={id => setProgressSelection({ courseId: courseId!, kind: 'student', id })} /></section> : activeView !== 'people' ? <section aria-labelledby="course-modules-title"><h2 id="course-modules-title" className="sr-only">{moduleHeading}</h2><div className="course-list">{moduleGroups.map((group, index) => <Fragment key={index}>{index > 0 && <hr className="course-list-divider" />}{group.map(module => moduleRow(detail, module))}</Fragment>)}</div>{!moduleGroups.length && <div className="course-content-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6" /></svg><p>{emptyTopics}</p></div>}</section> : !ownCourse ? <section aria-labelledby="course-people-title"><h2 id="course-people-title" className="sr-only">People</h2>
          <ul className="course-list course-people-list">{detail.people.map(person => <li className="course-student course-person" key={person.id}>
            <span className="course-student-avatar" aria-hidden="true"><Bloub static facingForward appearance={person.appearance} /></span>
            <span className="course-student-identity"><span className="course-row-title">{person.name}</span><span className="course-row-meta">{person.role === 'instructor' ? 'Teacher' : 'Student'}{person.id === account.id ? ' · You' : ''}</span></span>
          </li>)}</ul>
        </section> : <section aria-labelledby="course-students-title"><h2 id="course-students-title" className="sr-only">People</h2>
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
