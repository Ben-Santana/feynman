import { useEffect, useRef, useState } from 'react'
import { gainsScale, helpfulnessScale, submitSurvey, surveySections, type SurveyStatus } from '../learningSurvey'
import './LearningSurvey.css'

export function LearningSurveyDialog({ status, open, onLater, onSubmitted }: { open: boolean; status: NonNullable<SurveyStatus>; onLater: () => void; onSubmitted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; if (open) element?.showModal(); else element?.close(); return () => element?.close() }, [open])
  const change = (id: string, value: string) => setAnswers(current => ({ ...current, [id]: value }))
  function written(id: string, text: string) {
    return <label className="survey-written" key={id} htmlFor={`survey-${id}`}><span>{/^\d+$/.test(id) ? `${id}. ` : ''}{text}</span><textarea id={`survey-${id}`} required maxLength={5000} rows={3} value={answers[id] || ''} onChange={event => change(id, event.target.value)} /></label>
  }
  async function submit() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await submitSurvey(answers); onSubmitted() }
    catch (reason) { setError((reason as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="learning-survey-dialog" aria-labelledby="survey-title" aria-describedby="survey-requirement" onCancel={event => { event.preventDefault(); if (!busy) onLater() }}>
    <form onSubmit={event => { event.preventDefault(); void submit() }}>
      <header><div className="survey-dialog-heading"><h2 id="survey-title">Learning survey</h2><button type="button" aria-label="Complete survey later" disabled={busy} onClick={onLater}>Later</button></div><p>{status.topicTitle}</p><p id="survey-requirement">Complete this survey before your next topic. All questions require a response; you can write “None” where appropriate.</p></header>
      <fieldset disabled={busy} className="survey-fields">
        {surveySections.map((section, index) => <section key={section.title} aria-labelledby={`survey-section-${index}`}>
          <h3 id={`survey-section-${index}`}>{section.title}</h3>{section.prompt && <p>{section.prompt}</p>}
          {section.questions.map(([id, text]) => <fieldset className="survey-question" key={id}><legend>{id}. {text}</legend><div className="survey-options">{(Number(id) >= 16 ? helpfulnessScale : gainsScale).map(option => <label key={option}><input type="radio" name={`survey-${id}`} required value={option} checked={answers[id] === option} onChange={() => change(id, option)} /><span>{option}</span></label>)}</div></fieldset>)}
          {section.open && written(section.open[0], section.open[1])}
          {section.written?.map(([id, text]) => written(id, text))}
        </section>)}
      </fieldset>
      {error && <p className="account-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onLater}>Later</button><button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit survey'}</button></footer>
    </form>
  </dialog>
}
