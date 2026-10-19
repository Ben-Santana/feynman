import { validateCourseBannerFile, type CourseBanner } from './courseAppearance'
import { accountSignal, requireAccount, supabase } from './accounts'
import { decodeSession, encodeSession, flushSessionSaves, getSaveStatus, type CloudSession, type SavedSession } from './learningStore'
import { sessionComplete, type Concept, type Level, type Session } from './learningFlow'
import type { DashboardModule } from './dashboardData'
import { normalizeAppearance, type CharacterAppearance } from './characterAppearance'

export type EnrollmentMode = 'open' | 'approval'
export type EnrollmentStatus = 'pending' | 'enrolled' | 'rejected'
export type Course = { id: string; instructor_id: string; name: string; code: string; enrollment_mode: EnrollmentMode; created_at: string; banner?: CourseBanner; appearance_revision?: number; bannerUrl?: string | null; pinned?: boolean }
export type Enrollment = { course_id: string; student_id: string; status: EnrollmentStatus }
export type CourseModule = { id: string; course_id: string; title: string; document: CloudSession['document']; revision: number; published_at: string | null; created_at: string }
export type StudentProgress = { studentId: string; name: string; email: string; status: EnrollmentStatus; modules: { moduleId: string; started: boolean; concepts: { id: string; name: string; target: Level; passed: number }[] }[] }
export type ModuleProgress = { moduleId: string; complete: boolean }
export type CoursePerson = { id: string; name: string; role: 'instructor' | 'student'; appearance: CharacterAppearance }
export type ModuleSession = SavedSession<Concept, Session>

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const signal = accountSignal()
  const { data, error } = await supabase().rpc(name, args).abortSignal(signal)
  signal.throwIfAborted()
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42P01') throw new Error('Courses are not configured. Apply the latest course migrations, then retry.')
    throw new Error(error.message || 'Could not save changes. Please retry.')
  }
  return data as T
}
export async function loadCourses() {
  const signal = accountSignal()
  const [courses, enrollments, pins] = await Promise.all([
    supabase().from('courses').select('*').order('created_at', { ascending: false }).abortSignal(signal),
    supabase().from('course_enrollments').select('*').eq('student_id', requireAccount().id).abortSignal(signal),
    supabase().from('course_pins').select('course_id').eq('user_id', requireAccount().id).abortSignal(signal),
  ])
  signal.throwIfAborted()
  if (courses.error || enrollments.error) throw new Error('Could not load courses. Apply the courses migration if this is a new setup, then retry.')
  if (pins.error) throw new Error('Could not load pinned courses. Apply the latest course migrations, then retry.')
  const pinnedIds = new Set(pins.data.map(pin => pin.course_id))
  const resolved = await Promise.all((courses.data as Course[]).map(course => resolveCourseBanner({ ...course, pinned: pinnedIds.has(course.id) })))
  signal.throwIfAborted()
  return { courses: resolved, enrollments: enrollments.data as Enrollment[] }
}
export async function loadDashboardCourses() {
  const signal = accountSignal()
  const [courses, enrollments, modules] = await Promise.all([
    supabase().from('courses').select('id,instructor_id,name,code,enrollment_mode,created_at,banner').order('created_at', { ascending: false }).abortSignal(signal),
    supabase().from('course_enrollments').select('course_id,student_id,status').eq('student_id', requireAccount().id).abortSignal(signal),
    supabase().from('course_modules').select('id,course_id,title,published_at,created_at').order('created_at', { ascending: false }).abortSignal(signal),
  ])
  signal.throwIfAborted()
  if (courses.error || enrollments.error) throw new Error('Could not load classes. Please retry.')
  if (modules.error) throw new Error('Could not load class tasks. Please retry.')
  const resolved = await Promise.all((courses.data as Course[]).map(resolveCourseBanner))
  signal.throwIfAborted()
  return { courses: resolved, enrollments: enrollments.data as Enrollment[], modules: modules.data as DashboardModule[] }
}
export async function loadCourse(id: string) {
  const signal = accountSignal()
  const { courses, enrollments } = await loadCourses()
  const course = courses.find(value => value.id === id)
  if (!course) throw new Error('Course not found.')
  const instructor = course.instructor_id === requireAccount().id && requireAccount().role === 'instructor'
  const enrollment = enrollments.find(value => value.course_id === id)
  if (!instructor && enrollment?.status !== 'enrolled') return { course, enrollment, modules: [] as CourseModule[], progress: [] as StudentProgress[], ownProgress: [] as ModuleProgress[], people: [] as CoursePerson[] }
  const [modules, progress, people] = await Promise.all([
    supabase().from('course_modules').select('*').eq('course_id', id).order('published_at').order('created_at').order('id').abortSignal(signal),
    instructor ? rpc<StudentProgress[]>('course_progress', { target_course: id }) : Promise.resolve([]),
    rpc<CoursePerson[]>('course_people', { target_course: id }),
  ])
  signal.throwIfAborted()
  if (modules.error) throw new Error('Could not load modules. Please retry.')
  const ownProgress: ModuleProgress[] = []
  if (!instructor) {
    const links = await supabase().from('course_assignments').select('module_id,session_id').eq('student_id', requireAccount().id).abortSignal(signal)
    if (links.error) throw new Error('Could not load assignment progress. Please retry.')
    const relevant = links.data.filter(link => modules.data.some(module => module.id === link.module_id))
    if (relevant.length) {
      const saved = await supabase().from('learning_sessions').select('id,concepts:document->session->concepts').eq('owner_id', requireAccount().id).in('id', relevant.map(link => link.session_id)).abortSignal(signal)
      if (saved.error) throw new Error('Could not load assignment progress. Please retry.')
      for (const link of relevant) {
        const concepts = saved.data.find(row => row.id === link.session_id)?.concepts
        ownProgress.push({ moduleId: link.module_id, complete: Array.isArray(concepts) && sessionComplete(concepts as Concept[]) })
      }
    }
  }
  signal.throwIfAborted()
  return { course, enrollment, modules: modules.data as CourseModule[], progress, ownProgress, people: people.map(person => ({ ...person, appearance: normalizeAppearance(person.appearance) })) }
}
export const createCourse = (name: string, mode: EnrollmentMode) => rpc<Course>('create_course', { course_name: name, enrollment: mode })
export const setCoursePin = (id: string, pinned: boolean) => rpc<void>('set_course_pin', { target_course: id, pinned })
export const deleteCourse = (id: string) => rpc<void>('delete_course', { target_course: id })
export const joinCourse = (code: string) => rpc<Enrollment>('join_course', { course_code: code.trim().toUpperCase() })
export async function leaveCourse(id: string) {
  const signal = accountSignal()
  await flushSessionSaves()
  signal.throwIfAborted()
  if (getSaveStatus().state !== 'saved') throw new Error('Save your work and resolve any save conflicts before leaving a course.')
  await rpc<void>('leave_course', { target_course: id })
}
export const setEnrollmentMode = (id: string, mode: EnrollmentMode) => rpc<Course>('set_course_enrollment', { target_course: id, enrollment: mode })
export const decideEnrollment = (id: string, student: string, decision: 'enrolled' | 'rejected') => rpc<void>('decide_course_enrollment', { target_course: id, target_student: student, decision })
export async function saveModule(courseId: string, record: ModuleSession, revision: number) {
  const signal = accountSignal()
  const document = await encodeSession(record)
  signal.throwIfAborted()
  return rpc<CourseModule>('save_course_module', { target_course: courseId, target_module: record.id, module_title: record.title, module_document: document, expected_revision: revision })
}
export const deleteModule = (id: string, revision: number) => rpc<void>('delete_course_module', { target_module: id, expected_revision: revision })
export const publishModule = (id: string, revision: number) => rpc<CourseModule>('publish_course_module', { target_module: id, expected_revision: revision })
export async function loadModuleDraft(courseId: string, id: string) {
  const signal = accountSignal()
  const { data, error } = await supabase().from('course_modules').select('*').eq('course_id', courseId).eq('id', id).abortSignal(signal).single()
  signal.throwIfAborted()
  if (error || !data) throw new Error('Could not load the module. Please retry.')
  const module = data as CourseModule
  if (module.published_at) throw new Error('Published modules cannot be edited.')
  const record = await decodeSession<Concept, Session>({ owner_id: requireAccount().id, id, title: module.title, document: module.document, revision: module.revision, updated_at: module.created_at })
  return { record, revision: module.revision }
}
export async function startModule(id: string) {
  const signal = accountSignal()
  await flushSessionSaves()
  signal.throwIfAborted()
  if (getSaveStatus().state === 'conflict') throw new Error('Resolve the session save conflict before opening a module.')
  const row = await rpc<CloudSession>('start_course_module', { target_module: id })
  signal.throwIfAborted()
  return decodeSession<Concept, Session>(row, true)
}

async function resolveCourseBanner(course: Course): Promise<Course> {
  if (course.banner?.type !== 'image') return course
  const signal = accountSignal()
  const { data } = await supabase().storage.from('course-banners').createSignedUrl(course.banner.path, 3600)
  signal.throwIfAborted()
  return { ...course, bannerUrl: data?.signedUrl ?? null }
}
export async function updateCourseDetails(course: Course, changes: { name?: string; banner?: CourseBanner; enrollment?: EnrollmentMode }) {
  const signal = accountSignal()
  const saved = await rpc<Course>('update_course_details', { target_course: course.id, course_name: changes.name ?? null, course_banner: changes.banner ?? null, enrollment: changes.enrollment ?? null, expected_revision: course.appearance_revision ?? 1 })
  signal.throwIfAborted()
  return resolveCourseBanner(saved)
}

export async function uploadCourseBanner(courseId: string, file: File) {
  validateCourseBannerFile(file)
  const signal = accountSignal()
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
  const path = `${courseId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase().storage.from('course-banners').upload(path, file, { contentType: file.type, upsert: false })
  signal.throwIfAborted()
  if (error) throw new Error('Could not upload the banner. Please retry.')
  return path
}
export async function removeUnusedCourseBanner(path: string) {
  const signal = accountSignal()
  await supabase().storage.from('course-banners').remove([path])
  signal.throwIfAborted()
}
