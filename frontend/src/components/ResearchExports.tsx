import { useState } from 'react'
import { downloadResearchFile } from '../topicReports'
import { DownloadList, type DownloadItem } from './AnalyticsResearch'

export function ResearchExports({ course, courseName }: { course: string; courseName?: string }) {
  const [incomplete, setIncomplete] = useState(false)
  const [history, setHistory] = useState(false)
  const download = (kind: string) => downloadResearchFile(new URLSearchParams({ course, kind, includeIncomplete: incomplete ? '1' : '0', history: history ? '1' : '0' }))
  const needsCourse = course ? '' : 'Choose a course above.'
  const items: DownloadItem[] = [
    { label: 'Topic scores', detail: 'One row per participant and topic: first-attempt and final rubric scores, coverage, versions.', disabled: needsCourse, run: () => download('topics') },
    { label: 'Criterion details', detail: 'One row per rubric goal: credits, attempts, assistance, evaluator versions.', disabled: needsCourse, run: () => download('criteria') },
    { label: 'Scoring data dictionary', detail: 'Definitions for both score files.', run: () => download('dictionary') },
  ]
  return <section className="analytics-section" aria-labelledby="research-exports-title">
    <header className="analytics-section-header"><div><h2 id="research-exports-title">Topic scores</h2><p className="analytics-section-note">Rubric scores from assigned topics, for consented participants{courseName ? ` in ${courseName}` : ''}. Score exports are per course.</p></div></header>
    <div className="analytics-panel">
      <h3>Export options</h3>
      <p className="analytics-panel-note">By default, only each participant's latest report with full first-attempt and final coverage is included.</p>
      <label className="analytics-check"><input type="checkbox" checked={incomplete} onChange={event => setIncomplete(event.target.checked)} /> Include incomplete coverage</label>
      <label className="analytics-check"><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)} /> Include earlier report snapshots</label>
    </div>
    <DownloadList items={items} />
    <details className="analytics-restricted"><summary>Restricted roster matching</summary>
      <p>Maps participant codes to names and emails for joining classroom grades. It applies to every research file. Store it separately from the analysis files.</p>
      <DownloadList items={[{ label: 'Roster mapping', detail: 'Participant code, name and email.', disabled: needsCourse, run: () => download('roster') }]} />
    </details>
  </section>
}
