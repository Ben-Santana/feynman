import { useEffect, useState } from 'react'
import { gainsScale, helpfulnessScale, surveyCsv, surveyRpc, surveySections, type SurveyAnalytics } from '../learningSurvey'
import { LoadingScreen } from './AccountLoading'
import './AdminPage.css'
import './AdminAnalyticsPage.css'

export function AdminSalgSurveyPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [data, setData] = useState<SurveyAnalytics | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let disposed = false
    void surveyRpc<SurveyAnalytics>('admin_learning_survey_responses').then(result => { if (!disposed) { setData(result); setError('') } }).catch(reason => { if (!disposed) setError(reason.message) })
    return () => { disposed = true }
  }, [version])
  function download() {
    if (!data) return
    const url = URL.createObjectURL(new Blob([surveyCsv(data.responses)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'feynman-learning-survey-responses.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (!data && !error) return <LoadingScreen label="Loading survey analytics" />
  const total = data?.responses.length || 0
  return <section className="admin-page survey-analytics" aria-labelledby="survey-analytics-title"><div className="admin-shell">
    <button type="button" className="analytics-back" onClick={() => onNavigate('/admin/analytics')}>← Analytics</button>
    <header className="survey-analytics-header"><h1 id="survey-analytics-title">SALG survey</h1><div className="survey-analytics-actions"><button type="button" onClick={() => setVersion(value => value + 1)}>Refresh</button><button type="button" className="survey-export" disabled={!total} onClick={download}>Export responses (CSV)</button></div></header>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {data && <><dl className="survey-stat-cards"><div><dt>Submitted</dt><dd>{total}</dd></div><div><dt>Pending</dt><dd>{data.pending}</dd></div><div><dt>Completion rate</dt><dd>{total + data.pending ? `${Math.round(total / (total + data.pending) * 100)}%` : '—'}</dd></div></dl>
      {!total ? <p className="admin-empty">No survey responses yet.</p> : <><p className="survey-analytics-note">Ratings show counts and percentages of submitted responses. Means use 1–5 and exclude Not Applicable.</p>
        {surveySections.map(section => <section className="survey-analytics-section" key={section.title}><h2>{section.title}</h2>
          {section.questions.map(([id, text]) => {
            const scale = Number(id) >= 16 ? helpfulnessScale : gainsScale
            const counts = scale.map(option => data.responses.filter(row => row.answers[id] === option).length)
            const rated = counts.slice(0, 5).reduce((sum, count) => sum + count, 0)
            const mean = rated ? (counts.slice(0, 5).reduce((sum, count, index) => sum + count * (index + 1), 0) / rated).toFixed(2) : '—'
            return <article className="survey-distribution" key={id} aria-labelledby={`survey-question-${id}`}>
              <header className="survey-distribution-header"><h3 id={`survey-question-${id}`}><span className="survey-question-number">{id.padStart(2, '0')}</span>{text}</h3><div className="survey-mean"><strong>{mean}</strong><span>/ 5 mean</span></div></header>
              <p className="survey-distribution-meta">{rated} rated <span aria-hidden="true">·</span> {counts[5]} not applicable</p>
              <ul>{scale.map((option, index) => {
                const percentage = Math.round(counts[index] / total * 100)
                return <li key={option} className={counts[index] ? 'has-responses' : undefined}><span>{option}</span><span className="survey-bar" role="meter" aria-label={`${id}. ${option}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={counts[index]} aria-valuetext={`${counts[index]} of ${total} responses (${percentage}%)`}><span style={{ width: `${counts[index] / total * 100}%` }} /></span><span className="survey-bar-value">{counts[index]} <span>({percentage}%)</span></span></li>
              })}</ul>
            </article>
          })}
          {[...(section.open ? [section.open] : []), ...(section.written || [])].map(([id, text]) => <details className="survey-written-responses" key={id}><summary>{/^\d+$/.test(id) ? `${id}. ` : ''}{text}</summary>{data.responses.map(row => <article key={row.studentId}><strong>{row.name} · {row.topicTitle}</strong><p>{row.answers[id]}</p></article>)}</details>)}
        </section>)}
      </>}
    </>}
  </div></section>
}
