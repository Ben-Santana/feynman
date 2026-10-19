import { useEffect, useState } from 'react'
import { accountSignal, type Account } from '../accounts'
import type { CharacterAppearance } from '../characterAppearance'
import { loadDashboardCourses, type ModuleSession } from '../courseStore'
import { dashboardData, sessionProgress, type DashboardCourses } from '../dashboardData'
import { DashboardHeader } from './DashboardHeader'
import { CourseCover } from './CourseCover'
import { DeleteMenu } from './DeleteMenu'

const emptyCourses: DashboardCourses = { courses: [], enrollments: [], modules: [] }
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
function activityDate(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Today'
  today.setDate(today.getDate() - 1)
  return date.toDateString() === today.toDateString() ? 'Yesterday' : dateFormat.format(date)
}
function Arrow() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
}

export function DashboardPage({ account, appearance, sessions, onOpenSession, onDeleteSession, deletingSession, onCreateSession, onNavigate, onCustomizeAvatar, error }: {
  account: Account; appearance: CharacterAppearance; sessions: ModuleSession[]; onOpenSession: (session: ModuleSession) => void; onDeleteSession: (session: ModuleSession) => Promise<void>; deletingSession: boolean; onCreateSession: () => void; onNavigate: (path: string) => void; onCustomizeAvatar: () => void; error: string
}) {
  const [courses, setCourses] = useState<DashboardCourses>(emptyCourses)
  const [loading, setLoading] = useState(account.role !== 'admin')
  const [courseError, setCourseError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (account.role === 'admin') return
    let disposed = false
    const signal = accountSignal()
    const refresh = () => setVersion(value => value + 1)
    window.addEventListener('focus', refresh)
    queueMicrotask(() => { if (!disposed) { setLoading(true); setCourseError('') } })
    void loadDashboardCourses().then(data => { if (!disposed && !signal.aborted) setCourses(data) })
      .catch(reason => { if (!disposed && !signal.aborted) setCourseError(reason instanceof Error ? reason.message : 'Could not load classes.') })
      .finally(() => { if (!disposed && !signal.aborted) setLoading(false) })
    return () => { disposed = true; window.removeEventListener('focus', refresh) }
  }, [account.id, account.role, version])
  const { incomplete, todos, recentClasses } = dashboardData(account, sessions, courses)
  const showClasses = account.role !== 'admin'

  return <section className="dashboard-home" aria-label="Dashboard">
    <DashboardHeader appearance={appearance} onCustomizeAvatar={onCustomizeAvatar} onCreateSession={onCreateSession} />
    <div className="dashboard-body">
    {error && <p className="chat-error" role="alert">{error}</p>}
    {courseError && <div className="dashboard-load-error" role="alert"><p>{courseError}</p><button type="button" className="dashboard-text-link" onClick={() => setVersion(value => value + 1)}>Retry</button></div>}
    <div className={`dashboard-overview${showClasses ? '' : ' dashboard-overview-solo'}`}>
      <div className="dashboard-primary-column">
        <section className="dashboard-section" aria-labelledby="dashboard-todos-title" aria-busy={loading}>
          <div className="dashboard-section-heading"><h2 id="dashboard-todos-title">To do <span className="dashboard-count">{todos.length}</span></h2></div>
          {todos.length > 0 ? <ul className="dashboard-todo-list">{todos.slice(0, 5).map(todo => <li key={todo.id}><DeleteMenu label={todo.title} action="Delete session" disabled={deletingSession} onDelete={todo.session && !todo.session.assignment ? () => void onDeleteSession(todo.session!) : undefined}>
            <button type="button" className="dashboard-todo-row" onClick={() => todo.session ? onOpenSession(todo.session) : onNavigate(todo.path)}>
              <span className="dashboard-todo-mark" aria-hidden="true" />
              <span className="dashboard-row-copy"><strong>{todo.title}</strong><span>{todo.context}</span></span>
              <span className="dashboard-row-action">{todo.action}<Arrow /></span>
            </button>
          </DeleteMenu></li>)}</ul> : <p className="dashboard-empty" role="status">{loading ? 'Loading class tasks…' : courseError ? 'Class tasks are unavailable.' : 'No tasks to do.'}</p>}
          {todos.length > 5 && <p className="dashboard-list-note">Showing the 5 latest tasks. <button type="button" className="dashboard-text-link" onClick={() => onNavigate('/sessions')}>Sessions</button>{showClasses && <> · <button type="button" className="dashboard-text-link" onClick={() => onNavigate('/courses')}>Courses</button></>}</p>}
        </section>
        <section className="dashboard-section" aria-labelledby="dashboard-continue-title">
          <div className="dashboard-section-heading"><h2 id="dashboard-continue-title">Incomplete sessions <span className="dashboard-count">{incomplete.length}</span></h2><button type="button" className="dashboard-text-link" onClick={() => onNavigate('/sessions')}>View all<Arrow /></button></div>
          {incomplete.length > 0 ? <ul className="dashboard-continue-list">{incomplete.slice(0, 4).map(session => {
            const progress = sessionProgress(session)
            return <li key={session.id}><DeleteMenu label={session.title || 'Untitled session'} action="Delete session" disabled={deletingSession} onDelete={session.assignment ? undefined : () => void onDeleteSession(session)}><button type="button" className="dashboard-continue-row" onClick={() => onOpenSession(session)}>
              <span className="dashboard-row-copy"><strong>{session.title || 'Untitled session'}</strong><span>{session.assignment?.courseName || 'Custom session'}<span className="dashboard-meta-dot" aria-hidden="true">·</span><time dateTime={new Date(session.updatedAt).toISOString()}>{activityDate(session.updatedAt)}</time></span></span>
              <span className="dashboard-session-progress">{session.started ? <><span>{progress}%</span><span className="dashboard-progress-track" role="progressbar" aria-label={`${session.title || 'Untitled session'} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></span></> : <span className="dashboard-draft-label">In setup</span>}</span>
              <Arrow />
            </button></DeleteMenu></li>
          })}</ul> : <div className="dashboard-empty"><p>No incomplete sessions.</p><button type="button" className="dashboard-text-link" onClick={onCreateSession}>Start a session<Arrow /></button></div>}
        </section>
      </div>
      {showClasses && <section className="dashboard-section dashboard-classes" aria-labelledby="dashboard-classes-title" aria-busy={loading}>
        <div className="dashboard-section-heading"><h2 id="dashboard-classes-title">Recent classes</h2><button type="button" className="dashboard-text-link" onClick={() => onNavigate('/courses')}>View all<Arrow /></button></div>
        {recentClasses.length > 0 ? <ul className="dashboard-class-list">{recentClasses.slice(0, 4).map(({ course, enrollment, lastActivity }) => <li key={course.id}>
          <button type="button" className="dashboard-class-card" onClick={() => onNavigate(`/courses/${course.id}`)}>
            {course.banner?.type !== 'none' && <CourseCover banner={course.banner} imageUrl={course.bannerUrl} className="dashboard-class-cover" />}
            <span className="dashboard-class-card-body">
              <span className="dashboard-row-copy"><strong>{course.name}</strong><span>{enrollment === 'pending' ? 'Pending approval' : enrollment === 'rejected' ? 'Request rejected' : account.role === 'instructor' ? 'Teaching' : 'Enrolled'}<span className="dashboard-meta-dot" aria-hidden="true">·</span><time dateTime={new Date(lastActivity).toISOString()}>{activityDate(lastActivity)}</time></span></span>
              <span className="dashboard-class-card-arrow"><Arrow /></span>
            </span>
          </button>
        </li>)}</ul> : <div className="dashboard-empty" role="status"><p>{loading ? 'Loading classes…' : courseError ? 'Classes are unavailable.' : 'No classes yet.'}</p>{!loading && !courseError && <button type="button" className="dashboard-text-link" onClick={() => onNavigate(account.role === 'instructor' ? '/courses/new' : '/courses')}>{account.role === 'instructor' ? 'Create a course' : 'Join a course'}<Arrow /></button>}</div>}
      </section>}
    </div>
    </div>
  </section>
}
