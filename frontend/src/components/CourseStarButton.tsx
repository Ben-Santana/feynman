import type { Course } from '../courseStore'

export function CourseStarButton({ course, busy, onClick }: { course: Course; busy: boolean; onClick: () => void }) {
  if (!course.is_public) return null
  return <button type="button" className={`course-star-button${course.starred ? ' is-starred' : ''}`} aria-label={`${course.starred ? 'Unstar' : 'Star'} ${course.name}, ${course.star_count ?? 0} stars`} aria-pressed={Boolean(course.starred)} disabled={busy} onClick={onClick}>
    <svg viewBox="0 0 20 20" aria-hidden="true" fill={course.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="m10 2 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z" /></svg>
    <span>{course.star_count ?? 0}</span>
  </button>
}
