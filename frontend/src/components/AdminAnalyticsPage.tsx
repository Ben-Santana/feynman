import { useEffect, useState } from 'react'
import { gainsScale, helpfulnessScale, surveyCsv, surveyRpc, surveySections, type SurveyAnalytics } from '../learningSurvey'
import { LoadingScreen } from './AccountLoading'
import './LearningSurvey.css'

export function AdminAnalyticsPage() {
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
  return <section className="survey-analytics"><header><h1>Analytics</h1><h2>Learning survey</h2><div className="survey-analytics-actions"><button onClick={() => setVersion(value => value + 1)}>Refresh</button><button disabled={!total} onClick={download}>Download individual responses (CSV)</button></div></header>
    {error && <p role="alert" className="account-error">{error}</p>}
    {data && <><div className="survey-stat-cards"><div><strong>{total}</strong><span>Submitted</span></div><div><strong>{data.pending}</strong><span>Pending</span></div><div><strong>{total + data.pending ? `${Math.round(total / (total + data.pending) * 100)}%` : '—'}</strong><span>Completion rate</span></div></div>
      {!total ? <p>No survey responses yet.</p> : <><p>Ratings show counts and percentages of submitted responses. Means use 1–5 and exclude Not Applicable.</p>
        {surveySections.map(section => <section className="survey-analytics-section" key={section.title}><h2>{section.title}</h2>
          {section.questions.map(([id, text]) => {
            const scale = Number(id) >= 16 ? helpfulnessScale : gainsScale
            const counts = scale.map(option => data.responses.filter(row => row.answers[id] === option).length)
            const rated = counts.slice(0, 5).reduce((sum, count) => sum + count, 0)
            const mean = rated ? (counts.slice(0, 5).reduce((sum, count, index) => sum + count * (index + 1), 0) / rated).toFixed(2) : '—'
            return <article className="survey-distribution" key={id}><h3>{id}. {text}</h3><p>Mean: {mean} / 5 · Rated: {rated} · Not Applicable: {counts[5]}</p><ul>{scale.map((option, index) => <li key={option}><span>{option}</span><meter min={0} max={total} value={counts[index]} aria-label={`${id}. ${option}`} /><span>{counts[index]} ({Math.round(counts[index] / total * 100)}%)</span></li>)}</ul></article>
          })}
          {[...(section.open ? [section.open] : []), ...(section.written || [])].map(([id, text]) => <details className="survey-written-responses" key={id}><summary>{/^\d+$/.test(id) ? `${id}. ` : ''}{text}</summary>{data.responses.map(row => <article key={row.studentId}><strong>{row.name} · {row.topicTitle}</strong><p>{row.answers[id]}</p></article>)}</details>)}
        </section>)}
      </>}
    </>}
  </section>
}
