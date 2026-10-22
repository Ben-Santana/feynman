import type { Account } from './accounts.ts'
import type { Course, CourseModule, Enrollment, ModuleSession } from './courseStore.ts'
import { sessionComplete, targetCount } from './learningFlow.ts'

export type DashboardModule = Pick<CourseModule, 'id' | 'course_id' | 'title' | 'published_at' | 'created_at'>
export type DashboardCourses = { courses: Course[]; enrollments: Enrollment[]; modules: DashboardModule[] }
export type DashboardTodo = { id: string; title: string; context: string; action: string; updatedAt: number } & ({ session: ModuleSession; path?: never } | { path: string; session?: never })

export function sessionProgress(session: ModuleSession) {
  const total = session.concepts.reduce((sum, concept) => sum + targetCount(concept.target), 0)
  const passed = session.concepts.reduce((sum, concept) => sum + Math.min(concept.passed, targetCount(concept.target)), 0)
  return session.started && total ? Math.round(passed / total * 100) : 0
}

export function dashboardData(account: Account, sessions: ModuleSession[], data: DashboardCourses) {
  const incomplete = sessions.filter(session => !session.started || !sessionComplete(session.concepts)).sort((a, b) => b.updatedAt - a.updatedAt)
  const courses = data.courses.filter(course => account.role === 'instructor'
    ? course.instructor_id === account.id
    : account.role === 'student' && data.enrollments.some(enrollment => enrollment.course_id === course.id))
  const enrolled = new Set(data.enrollments.filter(enrollment => enrollment.status === 'enrolled').map(enrollment => enrollment.course_id))
  const todos: DashboardTodo[] = incomplete.filter(session => !session.started).map(session => ({
    id: `session-${session.id}`, title: session.title || 'Untitled session', context: session.assignment?.courseName || 'Session setup', action: 'Finish setup', session, updatedAt: session.updatedAt,
  }))
  for (const module of data.modules) {
    const course = courses.find(course => course.id === module.course_id)
    if (!course) continue
    if (account.role === 'instructor' && !module.published_at) {
      todos.push({ id: `module-${module.id}`, title: module.title || 'Untitled topic', context: course.name, action: 'Edit draft', path: `/courses/${course.id}/modules/${module.id}/edit`, updatedAt: Date.parse(module.created_at) })
    } else if (account.role === 'student' && enrolled.has(course.id) && module.published_at && !sessions.some(session => session.assignment?.moduleId === module.id)) {
      todos.push({ id: `module-${module.id}`, title: module.title, context: course.name, action: 'View topic', path: `/courses/${course.id}`, updatedAt: Date.parse(module.published_at) })
    }
  }
  const recentClasses = courses.map(course => ({
    course,
    lastActivity: Math.max(Date.parse(course.created_at), ...sessions.filter(session => session.assignment?.courseId === course.id).map(session => session.updatedAt), ...data.modules.filter(module => module.course_id === course.id).map(module => Date.parse(module.published_at || module.created_at))),
    enrollment: data.enrollments.find(enrollment => enrollment.course_id === course.id)?.status,
  })).sort((a, b) => b.lastActivity - a.lastActivity)
  return { incomplete, todos: todos.sort((a, b) => b.updatedAt - a.updatedAt), recentClasses }
}
