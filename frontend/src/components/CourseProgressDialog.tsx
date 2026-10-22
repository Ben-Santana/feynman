import { useEffect, useRef, useState } from 'react'
import type { CourseModule, StudentProgress } from '../courseStore'
import { levelIds, targetCount, type Concept } from '../learningFlow'
import { learningTypes, type LearningType } from '../learningTypes.js'
import { checklistItems } from '../rubricChecklist.js'

type Progress = StudentProgress['modules'][number]
export type CourseProgressSelection = { courseId: string; kind: 'student' | 'module'; id: string }

function status(progress?: Progress) {
  if (!progress?.started) return 'Not started'
  return progress.concepts.length > 0 && progress.concepts.every(concept => concept.passed >= targetCount(concept.target)) ? 'Complete' : 'In progress'
}

function ConceptProgress({ progress }: { progress?: Progress }) {
  return progress && <ul className="course-concept-progress">{progress.concepts.map(concept => {
    const target = targetCount(concept.target)
    const passed = Math.min(concept.passed, target)
    return <li key={concept.id}>
      <div className="course-concept-progress-heading"><span>{concept.name}</span><span>{passed} / {target} levels</span></div>
      <div className="level-slider-track course-concept-progress-track" role="progressbar" aria-label={`${concept.name} progress`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={passed} aria-valuetext={`${passed} of ${target} levels complete`}>
        <span className="level-slider-fill" style={{ width: `${passed / target * 100}%` }} aria-hidden="true" />
        {Array.from({ length: target }, (_, index) => <span className="level-slider-stop" style={{ left: `${(index + .5) / target * 100}%` }} key={index} aria-hidden="true" />)}
      </div>
    </li>
  })}</ul>
}

function ModuleRubric({ module }: { module: CourseModule }) {
  const session = module.document.session
  const concepts = session.concepts as Concept[]
  const learningType = session.learningType as LearningType
  return <section aria-label="Published rubric" className="course-published-rubric">
    <p>{learningTypes[learningType]?.label}</p>
    {concepts.map(concept => <section className="course-rubric-concept" key={concept.id}>
      <h3>{concept.name}</h3><p>Target: {concept.target.charAt(0).toUpperCase() + concept.target.slice(1)}</p>
      <div className="course-rubric-levels">{levelIds.slice(0, targetCount(concept.target)).map(level => <section key={level}><h4>{level.charAt(0).toUpperCase() + level.slice(1)}</h4><ul>{checklistItems(concept.rubric[level]).map((item, index) => <li key={index}>{item}</li>)}</ul></section>)}</div>
    </section>)}
  </section>
}

export function CourseProgressDialog({ selection, modules, students, onClose }: {
  selection: CourseProgressSelection; modules: CourseModule[]; students: StudentProgress[]; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [view, setView] = useState<'students' | 'rubric'>('students')
  const student = selection.kind === 'student' ? students.find(value => value.studentId === selection.id) : undefined
  const module = selection.kind === 'module' ? modules.find(value => value.id === selection.id && value.published_at) : undefined
  const published = modules.filter(value => value.published_at)
  const enrolled = students.filter(value => value.status === 'enrolled')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const completeCount = student ? student.modules.filter(value => status(value) === 'Complete').length : enrolled.filter(value => status(value.modules.find(progress => progress.moduleId === module?.id)) === 'Complete').length
  function close() { dialog.current?.close(); onClose() }
  return <dialog ref={dialog} className="course-edit-dialog course-progress-dialog" aria-labelledby="course-progress-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="course-edit-heading"><h2 id="course-progress-title">{student?.name ?? module?.title}</h2><button type="button" className="course-dialog-close" aria-label="Close progress" onClick={close} autoFocus><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
    {student ? <>
      <p className="course-progress-meta">{student.email}</p>
      {student.status === 'enrolled' ? <><p className="course-progress-total">{completeCount} / {published.length} topics complete</p>
        <div className="course-progress-list">{published.map(value => {
          const progress = student.modules.find(item => item.moduleId === value.id)
          return <section className="course-progress-card" key={value.id}><div className="course-progress-card-heading"><h3>{value.title}</h3><span className="course-progress-status" data-complete={status(progress) === 'Complete'}>{status(progress)}</span></div><ConceptProgress progress={progress} /></section>
        })}</div>{!published.length && <p>No published topics yet.</p>}
      </> : <p>{student.status === 'pending' ? 'Pending approval' : 'Request rejected'}</p>}
    </> : module ? <>
      <div className="course-progress-tabs" role="group" aria-label="Topic details"><button type="button" aria-pressed={view === 'students'} onClick={() => setView('students')}>Student progress</button><button type="button" aria-pressed={view === 'rubric'} onClick={() => setView('rubric')}>Rubric</button></div>
      {view === 'rubric' ? <ModuleRubric module={module} /> : <><p className="course-progress-total">{completeCount} / {enrolled.length} students complete</p>
        <div className="course-progress-list">{enrolled.map(value => {
          const progress = value.modules.find(item => item.moduleId === module.id)
          return <section className="course-progress-card" key={value.studentId}><div className="course-progress-card-heading"><div><h3>{value.name}</h3><p>{value.email}</p></div><span className="course-progress-status" data-complete={status(progress) === 'Complete'}>{status(progress)}</span></div><ConceptProgress progress={progress} /></section>
        })}</div>{!enrolled.length && <p>No enrolled students yet.</p>}
      </>}
    </> : <p>Progress is no longer available. Close this popup and retry loading the course.</p>}
  </dialog>
}
