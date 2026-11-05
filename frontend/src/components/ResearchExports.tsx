import { useState } from 'react'
import { downloadResearchFile } from '../topicReports'

export function ResearchExports() {
  const [course, setCourse] = useState('')
  const [incomplete, setIncomplete] = useState(false)
  const [history, setHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download(kind: string) {
    setBusy(true); setError('')
    try { await downloadResearchFile(new URLSearchParams({ course: course.trim(), kind, includeIncomplete: incomplete ? '1' : '0', history: history ? '1' : '0' })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not download the export.') }
    finally { setBusy(false) }
  }
  return <section className="research-exports" aria-labelledby="research-exports-title"><h2 id="research-exports-title">Research scores</h2>
    <label htmlFor="research-course">Course ID</label><input id="research-course" value={course} onChange={event => setCourse(event.target.value)} placeholder="Course UUID" />
    <p>Exports include signed participants in assigned topics. By default, only the latest report with full first-attempt and final coverage is included.</p>
    <label><input type="checkbox" checked={incomplete} onChange={event => setIncomplete(event.target.checked)} /> Include incomplete coverage</label>
    <label><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)} /> Include earlier report snapshots</label>
    <div className="research-export-actions"><button disabled={busy || !course.trim()} onClick={() => void download('topics')}>Topic scores CSV</button><button disabled={busy || !course.trim()} onClick={() => void download('criteria')}>Criterion details CSV</button><button disabled={busy} onClick={() => void download('dictionary')}>Scoring data dictionary</button></div>
    <details><summary>Restricted roster matching</summary><p>This separate file contains participant codes, names, and emails for joining classroom grades. Keep it separate from research data.</p><button disabled={busy || !course.trim()} onClick={() => void download('roster')}>Download roster mapping</button></details>
    {busy && <p role="status">Preparing download…</p>}{error && <p role="alert">{error}</p>}
  </section>
}
