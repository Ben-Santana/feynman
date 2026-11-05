import { useEffect, useState } from 'react'
import { BackButton } from './BackButton'
import { loadTopicReport, type ReportResponse, type TopicReportData } from '../topicReports'
import { flushSessionSaves } from '../learningStore'
import { accountSignal } from '../accounts'
import './TopicReport.css'

const percent = (value: number | null) => value === null ? '—' : `${value}%`

function CompletionChart({ report }: { report: TopicReportData }) {
  const concepts = new Map<string, { name: string; total: number; demonstrated: number; partial: number }>()
  for (const goal of report.goals) {
    const concept = concepts.get(goal.conceptId) ?? { name: goal.concept, total: 0, demonstrated: 0, partial: 0 }
    concept.total++
    if (goal.status === 'demonstrated') concept.demonstrated++
    if (goal.status === 'partial') concept.partial++
    concepts.set(goal.conceptId, concept)
  }
  return <section className="topic-report-chart" aria-labelledby="completion-title">
    <h2 id="completion-title">Completion by concept</h2>
    <ul className="topic-report-legend" aria-label="Chart legend">
      <li><i className="completion-demonstrated" aria-hidden="true" />Demonstrated</li>
      <li><i className="completion-partial" aria-hidden="true" />Partial</li>
      <li><i className="completion-remaining" aria-hidden="true" />Remaining</li>
    </ul>
    {concepts.size ? <ul className="topic-report-bars">{Array.from(concepts, ([id, concept]) =>
      <li key={id}>
        <div className="topic-report-bar-label"><span>{concept.name}</span><span>{concept.demonstrated}<small> / {concept.total}</small></span></div>
        <div className="topic-report-bar" role="img" aria-label={`${concept.name}: ${concept.demonstrated} of ${concept.total} goals demonstrated, ${concept.partial} partial, ${concept.total - concept.demonstrated - concept.partial} remaining`}>
          <span className="completion-demonstrated" style={{ width: `${concept.demonstrated / concept.total * 100}%` }} />
          <span className="completion-partial" style={{ width: `${concept.partial / concept.total * 100}%` }} />
        </div>
      </li>
    )}</ul> : <p className="topic-report-empty">No goals assigned.</p>}
  </section>
}

export function TopicReport({ sessionId, complete, onBack, onRestart, backDestination = 'sessions' }: { backDestination?: string; sessionId: string; complete: boolean; onBack: () => void; onRestart: () => Promise<void> }) {
  const [data, setData] = useState<ReportResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [restartError, setRestartError] = useState('')
  async function restart() {
    setRestarting(true)
    setRestartError('')
    try { await onRestart() }
    catch (reason) { setRestartError(reason instanceof Error ? reason.message : 'Could not restart the session. Please retry.') }
    finally { setRestarting(false) }
  }
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, accountSignal()])
    queueMicrotask(() => { if (!signal.aborted) { setLoading(true); setError(''); setData(null) } })
    void flushSessionSaves().then(() => loadTopicReport(sessionId, signal, complete ? 'completed' : 'early'))
      .then(result => { if (!signal.aborted) setData(result) })
      .catch(reason => { if (!signal.aborted) setError(reason.message) })
      .finally(() => { if (!signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sessionId, complete, revision])
  const report = data?.report
  return <section className="summary-page topic-report" aria-labelledby="topic-report-title">
    <nav className="back-navigation summary-nav" aria-label="Report navigation"><BackButton onClick={onBack} destination={backDestination} /></nav>
    <div className="summary-shell">
      <header className="topic-report-header"><h1 id="topic-report-title">{report?.title || 'Topic report'}</h1><button type="button" disabled={!data || loading || restarting} onClick={() => void restart()}>{restarting ? 'Restarting…' : 'Restart session'}</button></header>
      {restartError && <p role="alert" className="topic-report-error">{restartError}</p>}
      {loading && <p role="status">Saving your topic report…</p>}
      {error && <div role="alert" className="topic-report-error"><p>{error}</p><>{!data && <button disabled={loading} onClick={() => setRevision(value => value + 1)}>Retry saving report</button>}</></div>}
      {report && <>
        <dl className="topic-report-scores">
          <div><dt>Goals demonstrated</dt><dd>{report.demonstrated}<small> / {report.assigned}</small></dd></div>
          <div><dt>First-attempt score</dt><dd>{percent(report.first.percent)}</dd></div>
          <div><dt>Final score</dt><dd>{percent(report.final.percent)}</dd></div>
        </dl>
        <CompletionChart report={report} />
      </>}
    </div>
  </section>
}
