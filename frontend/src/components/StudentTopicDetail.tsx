import { useEffect, useState } from 'react'
import { loadStudentTopicSession, type StudentTopicSession } from '../courseStore'
import { levelIds, targetCount, type Concept, type Level } from '../learningFlow'
import { checklistItems } from '../rubricChecklist.js'
import { ChatText } from './ChatText'

type ItemStatus = 'demonstrated' | 'revision' | 'clarification' | 'skipped' | 'pending'
const statusLabels: Record<ItemStatus, string> = { demonstrated: 'Demonstrated', revision: 'Needs revision', clarification: 'Needs clarification', skipped: 'Skipped', pending: 'Not yet assessed' }
const levelName = (level: Level) => level[0].toUpperCase() + level.slice(1)

function levelItems(concept: Concept, level: Level, index: number) {
  const assessment = concept.assessments?.[level] ?? (index === concept.passed ? concept.assessment : null)
  return checklistItems(concept.rubric?.[level] ?? '').map(item => {
    const judgment = assessment?.criteria.find(criterion => criterion.aspect === item)
    const status: ItemStatus = judgment?.skipped ? 'skipped'
      : judgment?.status === 'supported' || (!judgment && index < concept.passed) ? 'demonstrated'
      : judgment?.status === 'flawed' ? 'revision'
      : judgment?.status === 'needs_clarification' ? 'clarification' : 'pending'
    const credit = status === 'demonstrated' ? 1 : status === 'revision' || status === 'skipped' ? 0 : null
    return { item, status, credit, quote: judgment?.evidence?.find(value => value.quote?.trim())?.quote }
  })
}

function ConceptRubric({ concept }: { concept: Concept }) {
  const target = targetCount(concept.target)
  return <div className="topic-detail-levels">{levelIds.slice(0, target).map((level, index) => {
    const items = levelItems(concept, level, index)
    const earned = items.reduce((total, value) => total + (value.credit ?? 0), 0)
    const state = index < concept.passed ? 'Passed' : index === concept.passed ? 'Current level' : 'Not reached'
    return <section className="topic-detail-level" key={level} data-state={index < concept.passed ? 'passed' : index === concept.passed ? 'current' : 'locked'}>
      <header><h4>{levelName(level)}</h4><span>{state}</span><strong>{earned} / {items.length} pts</strong></header>
      <ol>{items.map((value, itemIndex) => <li key={itemIndex} data-status={value.status}>
        <span className="topic-detail-mark" aria-hidden="true">{value.status === 'demonstrated' ? '✓' : value.status === 'revision' || value.status === 'skipped' ? '✕' : value.status === 'clarification' ? '?' : ''}</span>
        <div><p>{value.item}</p>{value.quote && <blockquote>“{value.quote}”</blockquote>}</div>
        <span className="topic-detail-item-status">{statusLabels[value.status]}<small>{value.credit === null ? '—' : `${value.credit} pt`}</small></span>
      </li>)}</ol>
    </section>
  })}</div>
}

function ConceptChat({ concept, studentName }: { concept: Concept; studentName: string }) {
  const messages = concept.messages.filter(message => message.content?.trim() || message.boardImage)
  if (messages.length <= 1) return <p className="topic-detail-empty">{studentName} hasn't replied yet.</p>
  return <ol className="topic-detail-chat">{messages.map((message, index) => <li key={message.id ?? index} data-role={message.role}>
    <span className="topic-detail-speaker">{message.role === 'user' ? studentName : 'Classmate'}{message.passedLevel && <em>Passed {levelName(message.passedLevel)}</em>}{message.helpRequest && <em>Asked for help</em>}</span>
    {message.content?.trim() && <div className="topic-detail-bubble"><ChatText>{message.content}</ChatText></div>}
    {message.boardImage && <img className="topic-detail-board" src={message.boardImage} alt={`Whiteboard from ${studentName}`} />}
  </li>)}</ol>
}

export function StudentTopicDetail({ courseId, moduleId, studentId, studentName }: { courseId: string; moduleId: string; studentId: string; studentName: string }) {
  const [state, setState] = useState<{ data?: StudentTopicSession | null; error?: string }>({})
  const [conceptId, setConceptId] = useState<string | null>(null)
  const [tab, setTab] = useState<'rubric' | 'chat'>('rubric')
  useEffect(() => {
    let live = true
    loadStudentTopicSession(courseId, moduleId, studentId)
      .then(data => { if (live) setState({ data }) })
      .catch((error: Error) => { if (live) setState({ error: error.message || 'Could not load this topic.' }) })
    return () => { live = false }
  }, [courseId, moduleId, studentId])
  if (state.error) return <p role="alert" className="topic-detail-empty">{state.error}</p>
  if (state.data === undefined) return <p role="status" className="topic-detail-empty">Loading…</p>
  if (!state.data?.concepts.length) return <p className="topic-detail-empty">{studentName} hasn't started this topic.</p>
  const concepts = state.data.concepts
  const concept = concepts.find(value => value.id === conceptId) ?? concepts[0]
  return <div className="topic-detail">
    {concepts.length > 1 && <div className="topic-detail-concepts" role="tablist" aria-label="Concepts">{concepts.map(value => {
      const target = targetCount(value.target)
      return <button type="button" role="tab" key={value.id} aria-selected={value.id === concept.id} onClick={() => setConceptId(value.id)}>
        <span>{value.name}</span><small>{Math.min(value.passed, target)} / {target} levels</small>
      </button>
    })}</div>}
    <div className="course-progress-tabs" role="group" aria-label="Concept details"><button type="button" aria-pressed={tab === 'rubric'} onClick={() => setTab('rubric')}>Rubric</button><button type="button" aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>Chat</button></div>
    {tab === 'rubric' ? <ConceptRubric concept={concept} /> : <ConceptChat concept={concept} studentName={studentName} />}
  </div>
}
