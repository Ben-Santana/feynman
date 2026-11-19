import { CollectionAddButton, CollectionSearch } from './CollectionSearch'
import { useEffect, useState } from 'react'
import { accountFetch } from '../accounts'
import { levelIds, type Level } from '../learningFlow'
import { learningTypes, type LearningType } from '../learningTypes.js'
import { LoadingScreen } from './AccountLoading'
import { CourseCard } from './CourseCard'
import { LibraryEmptyState } from './LibraryEmptyState'
import { CourseTeacherDialog } from './CourseTeacherDialog'
import { useConfirm } from './useConfirm'
import { useToast } from './useToast'
import { COURSE_SUBJECTS, type Course } from '../courseStore'
import { COMMUNITY_LIBRARY_ENABLED } from '../features'
import './CoursesPage.css'
import './AdminPage.css'
import './AdminCoursesPage.css'

type AdminCourse = {
  id: string; name: string; code: string; enrollment_mode: 'open' | 'approval'; created_at: string
  instructor: { id: string; name: string; email: string }; module_count: number
}
type CoursePage = { courses: (AdminCourse & Course)[]; total: number; page: number; pageSize: number }
type AdminModule = {
  id: string; title: string; revision: number; created_at: string; published_at: string | null; learningType: LearningType | null
  concepts: { id: string | null; name: string | null; target: Level | null; rubric: Record<Level, string | null> }[]
}
type CourseTeacher = { id: string; name: string; email: string; status: 'owner' | 'active' | 'invited' }
type CourseDetail = { course: Omit<AdminCourse, 'module_count'>; modules: AdminModule[]; teachers: CourseTeacher[] }
const levelLabels: Record<Level, string> = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze' }
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function useAdminData<T>(path: string) {
  const [request, setRequest] = useState<{ path: string; data?: T; error?: string } | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void accountFetch(path, { signal: controller.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load courses. Please retry.')
      if (!controller.signal.aborted) setRequest({ path, data })
    }).catch(reason => {
      if (!controller.signal.aborted) setRequest({ path, error: reason instanceof Error ? reason.message : 'Could not load courses. Please retry.' })
    })
    return () => controller.abort()
  }, [path, version])
  const current = request?.path === path ? request : null
  return { data: current?.data, error: current?.error, retry: () => { setRequest(null); setVersion(value => value + 1) } }
}

function LoadError({ error, retry }: { error: string; retry: () => void }) {
  return <div className="account-error admin-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>Retry loading</button></div>
}

function ModulePreview({ module }: { module: AdminModule }) {
  return <details className="admin-module">
    <summary><span><strong>{module.title || 'Untitled topic'}</strong><span className="admin-module-meta">{module.concepts.length} {module.concepts.length === 1 ? 'concept' : 'concepts'} · Revision {module.revision}</span></span><span className={`admin-module-status${module.published_at ? ' is-published' : ''}`}>{module.published_at ? 'Published' : 'Draft'}</span></summary>
    <div className="admin-module-preview">
      <dl className="admin-course-facts">
        <div><dt>Learning type</dt><dd>{module.learningType ? learningTypes[module.learningType]?.label || module.learningType : 'Not selected'}</dd></div>
        <div><dt>Created</dt><dd><time dateTime={module.created_at}>{dateLabel(module.created_at)}</time></dd></div>
        {module.published_at && <div><dt>Published</dt><dd><time dateTime={module.published_at}>{dateLabel(module.published_at)}</time></dd></div>}
      </dl>
      {module.concepts.length ? <ol className="admin-module-concepts">{module.concepts.map((concept, index) => <li key={`${concept.id ?? 'concept'}:${index}`}>
        <h3>{concept.name || 'Untitled concept'}</h3>
        <p className="admin-concept-target">Target: {concept.target ? levelLabels[concept.target] || concept.target : 'Not selected'}</p>
        <dl className="admin-concept-rubric">{levelIds.filter(level => concept.rubric[level]?.trim()).map(level => <div key={level}><dt>{levelLabels[level]}</dt><dd>{concept.rubric[level]}</dd></div>)}</dl>
        {!levelIds.some(level => concept.rubric[level]?.trim()) && <p className="admin-concept-target">No rubric yet.</p>}
      </li>)}</ol> : <p className="admin-empty">No concepts yet.</p>}
    </div>
  </details>
}

function CourseTeachers({ courseId, initial }: { courseId: string; initial: CourseTeacher[] }) {
  const [teachers, setTeachers] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const confirm = useConfirm()
  const toast = useToast()
  const path = `/api/admin/courses/${encodeURIComponent(courseId)}/teachers`
  async function request(url: string, init: RequestInit) {
    const response = await accountFetch(url, init)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not update the course teachers. Please retry.')
    setTeachers(data.teachers)
  }
  async function remove(teacher: CourseTeacher) {
    const name = teacher.name || teacher.email
    if (busy || !await confirm(teacher.status === 'invited'
      ? { title: `Cancel ${name}'s invitation?`, description: 'The invitation leaves their inbox.', confirmLabel: 'Hold to cancel invitation' }
      : { title: `Remove ${name}?`, description: 'They will lose access to this course. Topics they created stay in the course.', confirmLabel: 'Hold to remove' })) return
    setBusy(teacher.id); setError('')
    try {
      await request(`${path}/${encodeURIComponent(teacher.id)}`, { method: 'DELETE' })
      toast(teacher.status === 'invited' ? 'Invitation canceled.' : `Removed ${name}.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the course teachers. Please retry.') }
    finally { setBusy('') }
  }
  return <section aria-labelledby="admin-course-teachers-title">
    <div className="admin-modules-heading"><h2 id="admin-course-teachers-title">Teachers <span>{teachers.filter(teacher => teacher.status !== 'invited').length}</span></h2><button type="button" className="admin-teacher-add" disabled={Boolean(busy)} onClick={() => setAdding(true)}>Add teacher</button></div>
    {error && <p className="account-error admin-error" role="alert">{error}</p>}
    <div className="admin-directory"><ul className="admin-users admin-course-teachers">{teachers.map(teacher => <li key={teacher.id} aria-busy={busy === teacher.id}>
      <div className="admin-user-identity"><strong>{teacher.name || teacher.email.split('@')[0]}</strong><span>{teacher.email}</span></div>
      <div className="admin-teacher-actions">
        {teacher.status !== 'active' && <span className="admin-module-status">{teacher.status === 'owner' ? 'Owner' : 'Invited'}</span>}
        {teacher.status !== 'owner' && <button type="button" disabled={Boolean(busy)} onClick={() => void remove(teacher)}>{teacher.status === 'invited' ? 'Cancel invitation' : 'Remove'}</button>}
      </div>
    </li>)}</ul></div>
    {adding && <CourseTeacherDialog title="Add teacher" note="They get access right away, without an invitation." submitLabel="Add teacher" busyLabel="Adding…" onClose={() => setAdding(false)} onSubmit={async email => {
      await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      setAdding(false); toast(`Added ${email}.`)
    }} />}
  </section>
}

function CourseView({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const { data, error, retry } = useAdminData<CourseDetail>(`/api/admin/courses/${encodeURIComponent(courseId)}`)
  return <>
    <button type="button" className="admin-course-back" onClick={onBack}>← All courses</button>
    {!data && !error && <LoadingScreen label="Loading course" />}
    {error && <LoadError error={error} retry={retry} />}
    {data && <>
      <h1 id="admin-courses-title">{data.course.name}</h1>
      <dl className="admin-course-facts admin-course-overview">
        <div><dt>Course code</dt><dd>{data.course.code}</dd></div>
        <div><dt>Enrollment</dt><dd>{data.course.enrollment_mode === 'open' ? 'Open' : 'Approval required'}</dd></div>
        <div><dt>Created</dt><dd><time dateTime={data.course.created_at}>{dateLabel(data.course.created_at)}</time></dd></div>
      </dl>
      <CourseTeachers courseId={courseId} initial={data.teachers} />
      <div className="admin-modules-heading"><h2>Topics <span>{data.modules.length}</span></h2><span>View only</span></div>
      <div className="admin-modules">{data.modules.map(module => <ModulePreview key={module.id} module={module} />)}</div>
      {!data.modules.length && <p className="admin-empty">No topics yet.</p>}
    </>}
  </>
}

export function AdminCoursesPage({ courseId, onNavigate }: { courseId?: string; onNavigate: (path: string) => void }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [page, setPage] = useState(1)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setQuery(search.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  if (courseId) return <section className="admin-page admin-courses-page" aria-label="Course administration"><div className="admin-shell">
    <CourseView key={courseId} courseId={courseId} onBack={() => onNavigate('/admin/all-courses')} />
  </div></section>

  function clearFilters() {
    setSearch('')
    setQuery('')
    setSubjects([])
    setPage(1)
  }

  return <section className="courses-page course-library-page" aria-labelledby="courses-title">
    <h1 id="courses-title" className="sr-only">All Courses</h1>
    <div className="course-library-toolbar collection-toolbar">
      <CollectionSearch label="Search courses by name, code, or instructor" placeholder="Search courses" maxLength={200} value={search} onChange={setSearch} filters={COMMUNITY_LIBRARY_ENABLED ? {
        label: 'Subject', options: COURSE_SUBJECTS, selected: subjects,
        onToggle: subject => {
          setSubjects(previous => previous.includes(subject) ? previous.filter(value => value !== subject) : [...previous, subject])
          setPage(1)
        },
      } : undefined} />
      <CollectionAddButton label="Create course" text="Create" onClick={() => onNavigate('/courses/new')} />
    </div>
    <CourseDirectory page={page} query={query} subjects={subjects} setPage={setPage} onClear={clearFilters} onNavigate={onNavigate} />
  </section>
}

function CourseDirectory({ page, query, subjects, setPage, onClear, onNavigate }: {
  page: number; query: string; subjects: string[]; setPage: (page: number) => void; onClear: () => void; onNavigate: (path: string) => void
}) {
  const params = new URLSearchParams({ page: String(page), search: query })
  subjects.forEach(subject => params.append('subject', subject))
  const { data, error, retry } = useAdminData<CoursePage>(`/api/admin/courses?${params}`)
  if (error) return <LoadError error={error} retry={retry} />
  if (!data) return <LoadingScreen label="Loading courses" />
  const filtered = Boolean(query || subjects.length)
  return <>
    <div className="course-card-grid">{data.courses.map(course => <CourseCard key={course.id} course={course}
      status={course.instructor.name || course.instructor.email}
      onOpen={() => onNavigate(`/admin/all-courses/${course.id}`)}
    />)}</div>
    {!data.courses.length && <LibraryEmptyState kind="courses" title={filtered ? 'No matching courses' : 'No courses yet'}
      action={filtered ? { label: 'Clear filters', onClick: onClear } : undefined}
    />}
    {(page > 1 || data.total > data.pageSize) && <nav className="admin-pagination admin-course-pagination" aria-label="Course pages">
      <span>Page {page} · {data.total} {data.total === 1 ? 'course' : 'courses'}</span>
      <div className="admin-pagination-actions">
        <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </nav>}
  </>
}
