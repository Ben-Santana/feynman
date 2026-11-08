import { useEffect, useRef, useState } from 'react'
import { expectedScores, priorExposureOptions, ratingScale, submitPreTopic, type PreTopicAnswers, type PreTopicConcept } from '../research'
import './LearningSurvey.css'

export function PreTopicDialog({ moduleId, title, concepts, onCancel, onSubmitted }: { moduleId: string; title: string; concepts: PreTopicConcept[]; onCancel: () => void; onSubmitted: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const [answers, setAnswers] = useState<PreTopicAnswers>({ prior: '', expected: null, ratings: {} })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  async function submit() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await submitPreTopic(moduleId, answers); await onSubmitted() }
    catch (reason) { setError((reason as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="learning-survey-dialog pre-topic-dialog" aria-labelledby="pre-topic-title" aria-describedby="pre-topic-purpose" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <form onSubmit={event => { event.preventDefault(); void submit() }}>
      <header>
        <h2 id="pre-topic-title">Before you start</h2>
        <p className="pre-topic-name">{title}</p>
        <p id="pre-topic-purpose" className="pre-topic-purpose">These questions are for research on how well students can judge their own understanding. Your answers don't affect your score, and your instructor doesn't see them. Please answer honestly. There are no right or wrong answers.</p>
      </header>
      <fieldset disabled={busy} className="survey-fields">
        <fieldset className="survey-question">
          <legend>1. Have you studied this topic before?</legend>
          <div className="survey-options">{priorExposureOptions.map(([value, label]) => <label key={value}><input type="radio" name="pre-topic-prior" required value={value} checked={answers.prior === value} onChange={() => setAnswers(current => ({ ...current, prior: value }))} /><span>{label}</span></label>)}</div>
        </fieldset>
        <section aria-labelledby="pre-topic-ratings">
          <h3 id="pre-topic-ratings">2. How well do you understand each concept right now?</h3>
          {concepts.map(concept => <fieldset className="survey-question" key={concept.id}>
            <legend>{concept.name}</legend>
            <div className="survey-options pre-topic-scale">{ratingScale.map((label, index) => <label key={label}><input type="radio" name={`pre-topic-${concept.id}`} required value={index + 1} checked={answers.ratings[concept.id] === index + 1} onChange={() => setAnswers(current => ({ ...current, ratings: { ...current.ratings, [concept.id]: index + 1 } }))} /><span>{label}</span></label>)}</div>
          </fieldset>)}
        </section>
        <label className="pre-topic-expected" htmlFor="pre-topic-expected">
          <span>3. What score do you expect on this topic?</span>
          <select id="pre-topic-expected" required value={answers.expected ?? ''} onChange={event => setAnswers(current => ({ ...current, expected: event.target.value === '' ? null : Number(event.target.value) }))}>
            <option value="" disabled>Choose a score</option>
            {expectedScores.map(score => <option key={score} value={score}>{score}%</option>)}
          </select>
        </label>
      </fieldset>
      {error && <p className="account-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Starting…' : 'Start topic'}</button></footer>
    </form>
  </dialog>
}
