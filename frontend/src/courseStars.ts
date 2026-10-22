import type { Course } from './courseStore'

type StarState = Pick<Course, 'starred' | 'star_count'>
type PendingStar = { initial: boolean; count: number; confirmed: boolean; desired: boolean }

// Serialize requests per course while keeping every click immediately visible.
export function createCourseStarUpdates(save: (id: string, starred: boolean) => Promise<void>, update: (id: string, state: StarState) => void, onError: (error: unknown) => void) {
  const pending = new Map<string, PendingStar>()
  let version = 0
  let active = true
  function state(entry: PendingStar, starred = entry.desired): StarState {
    return { starred, star_count: Math.max(0, entry.count + Number(starred) - Number(entry.initial)) }
  }
  async function persist(id: string, entry: PendingStar) {
    try {
      do {
        const desired = entry.desired
        await save(id, desired)
        entry.confirmed = desired
      } while (entry.desired !== entry.confirmed)
    } catch (error) {
      if (active) { update(id, state(entry, entry.confirmed)); onError(error) }
    } finally {
      pending.delete(id)
      version++
    }
  }
  return {
    get version() { return version },
    setActive(value: boolean) { active = value },
    overlay(course: Course): Course {
      const entry = pending.get(course.id)
      return entry ? { ...course, ...state(entry) } : course
    },
    toggle(course: Course) {
      if (!active || !course.is_public) return
      let entry = pending.get(course.id)
      const running = Boolean(entry)
      if (!entry) {
        entry = { initial: Boolean(course.starred), count: course.star_count ?? 0, confirmed: Boolean(course.starred), desired: Boolean(course.starred) }
        pending.set(course.id, entry)
      }
      entry.desired = !entry.desired
      version++
      update(course.id, state(entry))
      if (!running) void persist(course.id, entry)
    },
  }
}
