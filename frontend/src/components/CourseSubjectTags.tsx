import { COURSE_SUBJECTS } from '../courseStore'
import './CourseSubjectTags.css'

export function CourseSubjectTags({ value, onChange, disabled = false }: { value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  return <fieldset className="course-subject-tags" disabled={disabled}>
    <legend>Subjects</legend>
    <div className="course-subject-options">{COURSE_SUBJECTS.map(subject => <button type="button" className="course-subject-tag" key={subject} aria-pressed={value.includes(subject)} onClick={() => onChange(value.includes(subject) ? value.filter(tag => tag !== subject) : [...value, subject])}>
      {value.includes(subject) && <span aria-hidden="true">✓</span>}{subject}
    </button>)}</div>
  </fieldset>
}
