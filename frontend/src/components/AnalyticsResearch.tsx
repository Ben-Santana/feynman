import { useEffect, useRef, useState } from 'react'
import { downloadResearchRows, downloadTrackingDictionary, loadResearchAnalytics, priorExposureOptions, ratingScale, type ResearchAnalytics } from '../research'

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const percent = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${Math.round(Number(value))}%`
const share = (part: number, whole: number) => whole ? percent(part / whole * 100) : '—'
const signed = (value: number | null) => value === null ? '—' : `${Number(value) > 0 ? '+' : Number(value) < 0 ? '−' : ''}${Math.abs(Math.round(Number(value)))} pts`
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const fullDate = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export type DownloadItem = { label: string; detail: string; disabled?: string; run: () => Promise<void> | void }
export function DownloadList({ items }: { items: DownloadItem[] }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function run(item: DownloadItem) {
    setBusy(item.label); setError('')
    try { await item.run() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not download the file.') } finally { setBusy('') }
  }
  return <div className="analytics-downloads">
    <ul>{items.map(item => <li key={item.label}>
      <div><strong>{item.label}</strong><span>{item.disabled || item.detail}</span></div>
      <button type="button" disabled={Boolean(busy) || Boolean(item.disabled)} onClick={() => void run(item)}>{busy === item.label ? 'Preparing…' : 'Download'}</button>
    </li>)}</ul>
    {error && <p role="alert" className="admin-error">{error}</p>}
  </div>
}

function useResearch(days: number, course: string) {
  const [version, setVersion] = useState(0)
  const key = `${days}:${course}:${version}`
  const [state, setState] = useState<{ key: string; data: ResearchAnalytics | null; error: string }>({ key: '', data: null, error: '' })
  useEffect(() => {
    let disposed = false
    void loadResearchAnalytics(days, course).then(data => { if (!disposed) setState({ key, data, error: '' }) }).catch(reason => { if (!disposed) setState({ key, data: null, error: reason.message }) })
    return () => { disposed = true }
  }, [days, course, key])
  // Results for a previous filter are hidden while the new ones load.
  const current = state.key === key
  return { data: current ? state.data : null, error: current ? state.error : '', refresh: () => setVersion(value => value + 1) }
}

function Stats({ items }: { items: [string, string, string?][] }) {
  return <dl className="analytics-stats">{items.map(([label, value, note]) => <div key={label}><dt>{label}</dt><dd>{value}</dd>{note && <span>{note}</span>}</div>)}</dl>
}

function useWidth(initial: number) {
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)))
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  return [container, width] as const
}

function DailyBars({ rows, metric }: { rows: ResearchAnalytics['engagement']['daily']; metric: 'students' | 'minutes' }) {
  const [active, setActive] = useState<number | null>(null)
  const [container, width] = useWidth(680)
  const unit = metric === 'students' ? 'active students' : 'active minutes'
  const max = Math.max(...rows.map(row => row[metric]), 0)
  const step = max <= 4 ? 1 : Math.pow(10, Math.floor(Math.log10(max / 2)))
  const ceiling = Math.max(1, Math.ceil(max / step) * step)
  const left = 48, right = width - 12, top = 16, bottom = 168
  const slot = (right - left) / rows.length
  const selected = active === null ? null : rows[active]
  return <div className="credit-daily-chart" ref={container}>
    <div className="credit-chart-readout" aria-live="polite">{selected ? <><span>{dayLabel(selected.date)}</span><strong>{number.format(selected[metric])}</strong><span>{unit}</span></> : <span>Daily {unit} · UTC</span>}</div>
    <svg viewBox={`0 0 ${width} 206`} role="img" aria-label={`Daily ${unit}. ${rows.length} days. Peak ${number.format(max)}.`}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={right} y1={bottom - fraction * (bottom - top)} y2={bottom - fraction * (bottom - top)} className="credit-gridline" /><text x={left - 10} y={bottom - fraction * (bottom - top) + 4} textAnchor="end">{number.format(ceiling * fraction)}</text></g>)}
      {rows.map((row, index) => {
        const height = row[metric] / ceiling * (bottom - top)
        return <g key={row.date} className={`credit-day${active === index ? ' is-active' : ''}`} tabIndex={0} role="img" aria-label={`${dayLabel(row.date)}: ${number.format(row[metric])} ${unit}`} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
          <rect x={left + index * slot} y={top} width={slot} height={bottom - top} fill="transparent" />
          {height > 0 && <rect className="credit-column" x={left + index * slot + slot * .18} y={bottom - height} width={slot * .64} height={height} rx={Math.min(3, slot * .2)} />}
        </g>
      })}
      {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].map(index => <text key={index} x={left + index * slot + slot / 2} y={194} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}>{dayLabel(rows[index].date)}</text>)}
    </svg>
    {!max && <p className="credit-chart-empty">No student activity in this period.</p>}
  </div>
}

function Retention({ cohorts }: { cohorts: ResearchAnalytics['engagement']['cohorts'] }) {
  if (!cohorts.length) return <p className="credit-empty">Cohorts appear after students' first recorded activity.</p>
  return <div className="analytics-table-scroll"><table className="analytics-table retention-table">
    <caption className="credit-sr-only">Share of each weekly cohort active in later weeks</caption>
    <thead><tr><th scope="col">First active week</th><th scope="col">Students</th>{[0, 1, 2, 3, 4].map(week => <th scope="col" key={week}>Week {week}</th>)}</tr></thead>
    <tbody>{cohorts.map(row => <tr key={row.week}><th scope="row">{dayLabel(row.week)}</th><td>{number.format(row.size)}</td>
      {row.active.map((count, index) => {
        const value = count === null || !row.size ? null : count / row.size * 100
        return <td key={index} className="retention-cell" style={value === null ? undefined : { ['--fill' as string]: `${Math.round(value * .45)}%` }} title={count === null ? 'Not reached yet' : `${count} of ${row.size} students`}>{value === null ? '—' : percent(value)}</td>
      })}</tr>)}</tbody>
  </table></div>
}

export function EngagementSection({ course }: { course: string }) {
  const [days, setDays] = useState(30)
  const [metric, setMetric] = useState<'students' | 'minutes'>('students')
  const { data, error, refresh } = useResearch(days, course)
  const e = data?.engagement
  return <section className="analytics-section" aria-labelledby="engagement-title">
    <header className="analytics-section-header"><div><h2 id="engagement-title">Engagement and retention</h2><p className="analytics-section-note">Consented students{course ? ' enrolled in this course' : ''}. Active time counts minutes with the app visible and in use.</p></div>
      <div className="credit-controls"><label><span className="credit-sr-only">Date range</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button type="button" disabled={!data && !error} onClick={refresh}>Refresh</button></div>
    </header>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {!data && !error && <p className="credit-loading" role="status">Loading engagement…</p>}
    {e && <>
      <Stats items={[
        ['Participants', number.format(e.participants), `${number.format(e.everActive)} with any activity`],
        ['Active students', number.format(e.active), `${share(e.active, e.participants)} of participants · ${days} days`],
        ['Returning students', number.format(e.returning), `${share(e.returning, e.active)} active on 2+ days`],
        ['Median active time', e.medianMinutes === null ? '—' : `${number.format(e.medianMinutes)} min`, `${number.format(e.minutes)} min total`],
        ['Topics completed', number.format(e.topicsCompleted), `${number.format(e.topicOpens)} topic opens`],
      ]} />
      <section className="credit-panel analytics-chart-panel"><header><h3>Daily activity</h3><div className="credit-metric-switch" role="group" aria-label="Activity metric"><button type="button" aria-pressed={metric === 'students'} onClick={() => setMetric('students')}>Students</button><button type="button" aria-pressed={metric === 'minutes'} onClick={() => setMetric('minutes')}>Active minutes</button></div></header><DailyBars rows={e.daily} metric={metric} /></section>
      <section className="credit-panel"><header><h3>Weekly retention</h3><span>Share of each cohort active N weeks after their first week · last 8 cohorts</span></header><Retention cohorts={e.cohorts} /></section>
      <p className="credit-note">{e.trackingStartedAt ? `Tracking started ${fullDate(e.trackingStartedAt)}. Earlier activity is not available.` : 'No activity recorded yet. Tracking starts once students open the app after this update.'}</p>
    </>}
    <h3 className="analytics-downloads-title">Downloads</h3>
    <DownloadList items={[
      { label: 'Activity summary', detail: 'One row per participant: first and last activity, active days, weeks and minutes, topics started and completed.', run: () => downloadResearchRows('activity_summary', course) },
      { label: 'Activity events', detail: 'Every recorded event with its time, session and topic.', run: () => downloadResearchRows('activity', course) },
      { label: 'Tracking data dictionary', detail: 'Definitions for the activity and pre-topic files.', run: downloadTrackingDictionary },
    ]} />
  </section>
}

function CalibrationPlot({ points }: { points: ResearchAnalytics['prequestionnaire']['points'] }) {
  const [active, setActive] = useState<number | null>(null)
  const [container, width] = useWidth(420)
  const size = Math.min(width, 420)
  const pad = 40, inner = size - pad - 12
  const x = (value: number) => pad + value / 100 * inner
  const y = (value: number) => 12 + (1 - value / 100) * inner
  const selected = active === null ? null : points[active]
  return <div className="calibration-plot" ref={container}>
    <div className="credit-chart-readout" aria-live="polite">{selected ? <><span>{selected.title}</span><strong>Expected {percent(selected.expected)} · scored {percent(selected.actual)}</strong></> : <span>Each dot is one student's topic</span>}</div>
    <svg viewBox={`0 0 ${size} ${size + 28}`} width={size} role="img" aria-label={`Expected score against actual score for ${points.length} completed topics. Dots below the diagonal are overconfident.`}>
      {[0, 50, 100].map(value => <g key={value}>
        <line className="credit-gridline" x1={x(0)} x2={x(100)} y1={y(value)} y2={y(value)} />
        <line className="credit-gridline" x1={x(value)} x2={x(value)} y1={y(0)} y2={y(100)} />
        <text x={pad - 8} y={y(value) + 4} textAnchor="end">{value}%</text>
        <text x={x(value)} y={y(0) + 18} textAnchor="middle">{value}%</text>
      </g>)}
      <line className="calibration-diagonal" x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} />
      <text className="calibration-region" x={x(97)} y={y(6)} textAnchor="end">Overconfident</text>
      <text className="calibration-region" x={x(3)} y={y(92)}>Underconfident</text>
      <text x={x(50)} y={size + 24} textAnchor="middle">Expected score</text>
      {points.map((point, index) => <g key={index} tabIndex={0} role="img" className={`calibration-point${active === index ? ' is-active' : ''}`} aria-label={`${point.title}: expected ${percent(point.expected)}, scored ${percent(point.actual)}`} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
        <circle cx={x(point.expected)} cy={y(Number(point.actual))} r={12} fill="transparent" />
        <circle className="calibration-dot" cx={x(point.expected)} cy={y(Number(point.actual))} r={5} />
      </g>)}
    </svg>
    <p className="calibration-axis-note">Vertical axis: actual topic score. On the diagonal, the student predicted their score exactly.</p>
    {!points.length && <p className="credit-chart-empty">Dots appear when students finish topics they answered questions for.</p>}
  </div>
}

function HorizontalBars({ rows, label }: { rows: { name: string; value: number | null; meta: string }[]; label: string }) {
  return <ul className="credit-feature-bars">{rows.map(row => <li key={row.name}>
    <div><span>{row.name}</span><strong>{row.value === null ? '—' : label === 'percent' ? percent(row.value) : number.format(row.value)}</strong></div>
    <span className="credit-bar-track" role="meter" aria-label={row.name} aria-valuemin={0} aria-valuemax={label === 'percent' ? 100 : Math.max(...rows.map(item => item.value || 0), 1)} aria-valuenow={row.value || 0} aria-valuetext={`${row.value === null ? 'No data' : label === 'percent' ? percent(row.value) : row.value}. ${row.meta}`}><span style={{ width: `${label === 'percent' ? Number(row.value || 0) : Number(row.value || 0) / Math.max(...rows.map(item => item.value || 0), 1) * 100}%` }} /></span>
    <div className="credit-row-meta"><span>{row.meta}</span></div>
  </li>)}</ul>
}

export function PreTopicSection({ course }: { course: string }) {
  const { data, error, refresh } = useResearch(30, course)
  const p = data?.prequestionnaire
  return <section className="analytics-section" aria-labelledby="pre-topic-analytics-title">
    <header className="analytics-section-header"><div><h2 id="pre-topic-analytics-title">Pre-topic questions</h2><p className="analytics-section-note">Self-assessment before each assigned topic, compared with the score from that first attempt. All time.</p></div>
      <div className="credit-controls"><button type="button" disabled={!data && !error} onClick={refresh}>Refresh</button></div>
    </header>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {!data && !error && <p className="credit-loading" role="status">Loading pre-topic answers…</p>}
    {p && <>
      <Stats items={[
        ['Responses', number.format(p.responses), `${number.format(p.students)} students · ${number.format(p.topics.length)} topics`],
        ['Completed', number.format(p.completed), `${share(p.completed, p.responses)} finished the topic`],
        ['Mean expected score', percent(p.expected), 'All responses'],
        ['Mean actual score', percent(p.actual), 'Completed topics'],
        ['Calibration gap', signed(p.gap), p.gap === null ? 'Expected minus actual' : Number(p.gap) > 0 ? 'Overconfident on average' : Number(p.gap) < 0 ? 'Underconfident on average' : 'Accurate on average'],
      ]} />
      <div className="analytics-two-column">
        <section className="credit-panel"><header><h3>Expected vs actual score</h3><span>{number.format(p.points.length)} completed topics</span></header><CalibrationPlot points={p.points} /></section>
        <div className="analytics-stack">
          <section className="credit-panel"><header><h3>Self-rating vs concept score</h3><span>Mean concept score</span></header>
            <HorizontalBars label="percent" rows={p.ratings.map(row => ({ name: `${row.rating} · ${ratingScale[row.rating - 1]}`, value: row.score, meta: `${number.format(row.count)} ratings · ${number.format(row.scored)} with a score` }))} /></section>
          <section className="credit-panel"><header><h3>Studied the topic before</h3><span>Responses</span></header>
            <HorizontalBars label="count" rows={priorExposureOptions.map(([value, name]) => ({ name, value: p.prior[value], meta: share(p.prior[value], p.responses) + ' of responses' }))} /></section>
        </div>
      </div>
      <section className="credit-panel"><header><h3>By topic</h3><span>Gap is expected minus actual</span></header>
        {!p.topics.length ? <p className="credit-empty">Topics appear after students answer the pre-topic questions.</p> : <div className="analytics-table-scroll"><table className="analytics-table">
          <thead><tr><th scope="col">Topic</th><th scope="col">Course</th><th scope="col">Responses</th><th scope="col">Completed</th><th scope="col">Expected</th><th scope="col">Actual</th><th scope="col">Gap</th></tr></thead>
          <tbody>{p.topics.map(row => <tr key={row.moduleId}><th scope="row">{row.title}</th><td>{row.course || '—'}</td><td>{number.format(row.responses)}</td><td>{number.format(row.completed)}</td><td>{percent(row.expected)}</td><td>{percent(row.actual)}</td><td>{row.expected === null || row.actual === null ? '—' : signed(Number(row.expected) - Number(row.actual))}</td></tr>)}</tbody>
        </table></div>}
      </section>
      <p className="credit-note">Students answer before their first attempt; restarts are not asked again. Expected score is compared with the score shown to the student. The CSV also includes rubric research scores.</p>
    </>}
    <h3 className="analytics-downloads-title">Downloads</h3>
    <DownloadList items={[
      { label: 'Pre-topic answers', detail: 'One row per participant, topic and concept: answers, completion, topic, concept and rubric scores.', run: () => downloadResearchRows('prequestionnaire', course) },
      { label: 'Tracking data dictionary', detail: 'Question wording, scales and score definitions.', run: downloadTrackingDictionary },
    ]} />
  </section>
}
