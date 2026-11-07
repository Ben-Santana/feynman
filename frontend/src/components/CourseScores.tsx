import type { CourseModule, StudentProgress } from '../courseStore'
import { formatScore, studentScoreSummary, topicScoreSummary } from '../courseScores'

const average = (score: number | null) => score === null ? '—' : formatScore(score)

export function CourseScores({ modules, students, onOpenTopic, onOpenStudent }: {
  modules: CourseModule[]; students: StudentProgress[]; onOpenTopic: (id: string) => void; onOpenStudent: (id: string) => void
}) {
  const published = modules.filter(module => module.published_at)
  const enrolled = students.filter(student => student.status === 'enrolled')
  if (!published.length || !enrolled.length) return <div className="course-content-empty"><p>{published.length ? 'No enrolled students yet.' : 'No published topics yet.'}</p></div>
  return <div className="course-scores">
    <section aria-labelledby="course-scores-topics-title">
      <h3 id="course-scores-topics-title">Topics</h3>
      <div className="course-score-table-wrap"><table className="course-score-table">
        <thead><tr><th scope="col">Topic</th><th scope="col">Completed</th><th scope="col">In progress</th><th scope="col">Not started</th><th scope="col">Average score</th></tr></thead>
        <tbody>{published.map(module => {
          const summary = topicScoreSummary(module.id, enrolled)
          return <tr key={module.id}><th scope="row"><button type="button" onClick={() => onOpenTopic(module.id)}>{module.title || 'Untitled topic'}</button></th><td>{summary.complete} / {enrolled.length}</td><td>{summary.inProgress}</td><td>{summary.notStarted}</td><td>{average(summary.average)}</td></tr>
        })}</tbody>
      </table></div>
    </section>
    <section aria-labelledby="course-scores-students-title">
      <h3 id="course-scores-students-title">Students</h3>
      <div className="course-score-table-wrap"><table className="course-score-table">
        <thead><tr><th scope="col">Student</th><th scope="col">Completed</th><th scope="col">In progress</th><th scope="col">Not started</th><th scope="col">Average score</th></tr></thead>
        <tbody>{enrolled.map(student => {
          const summary = studentScoreSummary(student, published.map(module => module.id))
          return <tr key={student.studentId}><th scope="row"><button type="button" onClick={() => onOpenStudent(student.studentId)}>{student.name}</button></th><td>{summary.complete} / {published.length}</td><td>{summary.inProgress}</td><td>{summary.notStarted}</td><td>{average(summary.average)}</td></tr>
        })}</tbody>
      </table></div>
    </section>
  </div>
}
