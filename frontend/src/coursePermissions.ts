import type { UserRole } from './accounts.ts'

export function canTeachCourses(role: UserRole) {
  return role === 'instructor' || role === 'admin'
}
