import { useEffect, useState } from 'react'
import { BackButton } from './BackButton'
import { Bloub } from './Bloub'
import { ReadingText } from './ReadingText'
import { ScoreProof } from './ScoreProof'
import { TooltipButton } from './TooltipButton'
import { useConfirm } from './useConfirm'
import { loadStudyGuidance, loadTopicReport, type ConceptScore, type GoalOutcome, type PointsSummary, type ReportGoal, type ReportResponse } from '../topicReports'
import { formatScore } from '../courseScores'
import type { CharacterAppearance } from '../characterAppearance'
import type { Level } from '../learningFlow'
import { flushSessionSaves } from '../learningStore'
import { accountSignal } from '../accounts'
import './TopicReport.css'

const outcomeLabels: Record<GoalOutcome, string> = { correct: 'Correct', corrected: 'Corrected a mistake', slow: 'Took extra time', skipped: 'Skipped', unfinished: 'Not finished' }
const levelLabel = (level: Level) => level[0].toUpperCase() + level.slice(1)
const percentLabel = (score: PointsSummary) => score.percent === null ? '—' : formatScore(score.percent)

function ScoreBar({ score }: { score: PointsSummary }) {
  return <span className="topic-report-bar" aria-hidden="true"><span style={{ width: `${score.percent ?? 0}%` }} /></span>
}

function ScoreRing({ score }: { score: PointsSummary }) {
  const percent = score.percent ?? 0
  return <div className="topic-report-ring">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle className="topic-report-ring-track" cx="60" cy="60" r="54" />
      {percent > 0 && <circle className="topic-report-ring-value" cx="60" cy="60" r="54" pathLength="100" strokeDasharray={`${percent} 100`} />}
    </svg>
    <p className="topic-report-ring-label"><strong>{percentLabel(score)}</strong><span>{score.earned}/{score.possible}</span></p>
  </div>
}

function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`topic-report-skeleton ${className}`} aria-hidden="true" />
}

function FocusLinesSkeleton() {
  return <div className="topic-report-skeleton-lines"><Skeleton /><Skeleton /><Skeleton className="topic-report-skeleton-short" /></div>
}

function ReportSkeleton() {
  return <div className="topic-report-loading" role="status" aria-label="Loading report">
    <section className="topic-report-total"><Skeleton className="topic-report-ring" /></section>
    <section className="topic-report-focus">
      <Skeleton className="topic-report-focus-art" />
      <div className="topic-report-focus-copy"><Skeleton className="topic-report-skeleton-heading" /><FocusLinesSkeleton /></div>
    </section>
    <Skeleton className="topic-report-skeleton-heading" />
    <div className="summary-concepts">{[0, 1, 2].map(index => <div className="summary-concept topic-report-concept" key={index}>
      <div className="summary-concept-heading"><span className="summary-concept-title"><Skeleton className="topic-report-skeleton-concept" /><span className="topic-report-bar" /></span><Skeleton className="topic-report-skeleton-score" /></div>
    </div>)}</div>
  </div>
}

function FocusSummary({ sessionId, snapshot, appearance, perfect }: { sessionId: string; snapshot?: string; appearance: CharacterAppearance; perfect: boolean }) {
  const [steps, setSteps] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, accountSignal()])
    queueMicrotask(() => { if (!signal.aborted) setError('') })
    loadStudyGuidance(sessionId, snapshot, signal)
      .then(result => { if (!signal.aborted) setSteps(result.nextSteps) })
      .catch(reason => { if (!signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [sessionId, snapshot, revision])
  return <section className="topic-report-focus" aria-labelledby="topic-report-focus-title">
    <span className="topic-report-focus-art" aria-hidden="true"><Bloub static facingForward appearance={appearance} /></span>
    <div className="topic-report-focus-copy">
      <h2 id="topic-report-focus-title">{perfect ? 'Next steps' : 'What to focus on'}</h2>
      {steps ? <ol>{steps.map(step => <li key={step}><ReadingText>{step}</ReadingText></li>)}</ol>
        : error ? <div role="alert" className="topic-report-focus-error"><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>
        : <div role="status" aria-label="Loading focus areas"><FocusLinesSkeleton /></div>}
    </div>
  </section>
}

function ConceptScoreCard({ concept, goals }: { concept: ConceptScore; goals: ReportGoal[] }) {
  const levels = [...new Set(goals.map(goal => goal.level))]
  return <div className="summary-concept topic-report-concept">
    <div className="summary-concept-heading">
      <span className="summary-concept-title"><h3>{concept.name}</h3><ScoreBar score={concept} /></span>
      <span className="topic-report-concept-score" aria-label={`${concept.earned} of ${concept.possible} points`}><strong>{concept.earned}</strong> / {concept.possible}</span>
    </div>
    <div className="summary-concept-content">
      {levels.map(level => <section className="summary-level" key={level} aria-label={`${levelLabel(level)} items for ${concept.name}`}>
        <div className="summary-level-heading"><h4>{levelLabel(level)}</h4></div>
        <ul className="topic-report-items" role="list">{goals.filter(goal => goal.level === level).map(goal => <li key={goal.id}>
          <ScoreProof goal={goal} label={outcomeLabels[goal.outcome]} />
          <span className="topic-report-item-text"><ReadingText>{goal.text}</ReadingText><small>{outcomeLabels[goal.outcome]}</small></span>
        </li>)}</ul>
      </section>)}
    </div>
  </div>
}

export function TopicReport({ sessionId, complete, appearance, onBack, onRestart, backDestination = 'sessions' }: { backDestination?: string; sessionId: string; appearance: CharacterAppearance; complete: boolean; onBack: () => void; onRestart: () => Promise<void> }) {
  const [data, setData] = useState<ReportResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [restartError, setRestartError] = useState('')
  const confirm = useConfirm()
  async function restart() {
    if (!await confirm({ title: 'Restart session?', description: 'You’ll start this topic over in a new session. This report stays saved.', confirmLabel: 'Hold to restart' })) return
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
      <header className="topic-report-header"><h1 id="topic-report-title" aria-label={loading ? 'Topic report' : undefined}>{report?.title || (loading ? <Skeleton className="topic-report-skeleton-title" /> : 'Topic report')}</h1><TooltipButton type="button" className="topic-report-restart" aria-label="Restart session" aria-busy={restarting} tooltip="Restart session" tooltipVariant="warning" disabled={!data || loading || restarting} onClick={() => void restart()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg></TooltipButton></header>
      {restartError && <p role="alert" className="topic-report-error">{restartError}</p>}
      {loading && <ReportSkeleton />}
      {error && <div role="alert" className="topic-report-error"><p>{error}</p><>{!data && <button disabled={loading} onClick={() => setRevision(value => value + 1)}>Retry saving report</button>}</></div>}
      {report && <>
        <section className="topic-report-total" aria-labelledby="topic-report-total-title">
          <h2 className="topic-report-visually-hidden" id="topic-report-total-title">Topic score</h2>
          <ScoreRing score={report.score} />
          {report.score.unfinished > 0 && <p className="topic-report-total-note">{report.score.unfinished} not finished</p>}
        </section>
        <FocusSummary key={data.id} sessionId={sessionId} snapshot={data.id} appearance={appearance} perfect={report.score.possible > 0 && report.score.earned === report.score.possible} />
        <section aria-labelledby="topic-report-concepts-title">
          <h2 className="topic-report-section-title" id="topic-report-concepts-title">Concept scores</h2>
          <div className="summary-concepts">{report.concepts.map(concept => <ConceptScoreCard key={concept.id} concept={concept} goals={report.goals.filter(goal => goal.conceptId === concept.id)} />)}</div>
        </section>
      </>}
    </div>
  </section>
}
