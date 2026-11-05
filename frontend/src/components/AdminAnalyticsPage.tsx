import { useEffect, useRef, useState } from 'react'
import { accountFetch } from '../accounts'
import './AdminPage.css'
import './AdminAnalyticsPage.css'
import { ResearchExports } from './ResearchExports'

type Metric = 'cost' | 'tokens'
type UsageRow = { name: string; cost: number | null; tokens: number; calls: number }
type UserUsage = UsageRow & { id: string | null; email: string | null }
type Usage = {
  days: number; generatedAt: string
  totals: { cost: number | null; tokens: number; calls: number; users: number; unpriced: number; unreported: number }
  daily: { date: string; cost: number | null; tokens: number; calls: number }[]
  features: UsageRow[]; users: UserUsage[]
}
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
const format = (value: number | null, metric: Metric) => value === null ? '—' : metric === 'cost' ? (value > 0 && value < .01 ? usd : cents).format(value) : number.format(value)
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function StatValue({ value, metric }: { value: number | null; metric: Metric }) {
  const full = format(value, metric)
  const compact = value === null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2, ...(metric === 'cost' ? { style: 'currency', currency: 'USD' } : {}) }).format(value)
  return <span title={full}><span className="credit-stat-full">{full}</span><span className="credit-stat-compact" aria-label={full}>{compact}</span></span>
}

function DailyChart({ rows, metric }: { rows: Usage['daily']; metric: Metric }) {
  const [active, setActive] = useState<number | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(680)
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)))
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const max = Math.max(...rows.map(row => Number(row[metric] || 0)), 0)
  const ceiling = max ? Math.pow(10, Math.floor(Math.log10(max))) * Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) : 1
  const selected = active === null ? null : rows[active]
  const left = 72, right = width - 12, top = 16, bottom = 168
  const slot = (right - left) / rows.length
  return <div className="credit-daily-chart" ref={container}>
    <div className="credit-chart-readout" aria-live="polite">{selected ? <><span>{dateLabel(selected.date)}</span><strong>{format(selected[metric], metric)}</strong><span>{number.format(selected.calls)} AI calls</span></> : <span>Daily {metric === 'cost' ? 'estimated spend (USD)' : 'tokens'} · UTC</span>}</div>
    <svg viewBox={`0 0 ${width} 206`} role="img" aria-label={`Daily ${metric === 'cost' ? 'estimated credit spend in US dollars' : 'token usage'}. ${rows.length} days.`}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={right} y1={bottom - fraction * (bottom - top)} y2={bottom - fraction * (bottom - top)} className="credit-gridline" /><text x={left - 12} y={bottom - fraction * (bottom - top) + 4} textAnchor="end">{metric === 'cost' ? `$${(ceiling * fraction).toLocaleString('en-US', { maximumFractionDigits: 4 })}` : Intl.NumberFormat('en-US', { notation: 'compact' }).format(ceiling * fraction)}</text></g>)}
      {rows.map((row, index) => {
        const height = Number(row[metric] || 0) / ceiling * (bottom - top)
        return <g key={row.date} className={`credit-day${active === index ? ' is-active' : ''}`} tabIndex={0} role="img" aria-label={`${dateLabel(row.date)}: ${format(row[metric], metric)}, ${row.calls} AI calls`} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
          <rect x={left + index * slot} y={top} width={slot} height={bottom - top} fill="transparent" />
          <rect className="credit-column" x={left + index * slot + slot * .18} y={bottom - height} width={slot * .64} height={height} rx={Math.min(2, slot * .1)} />
          <title>{dateLabel(row.date)}: {format(row[metric], metric)}</title>
        </g>
      })}
      {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].map(index => <text key={index} x={left + index * slot + slot / 2} y={194} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}>{dateLabel(rows[index].date)}</text>)}
    </svg>
    {!max && <p className="credit-chart-empty">{rows.some(row => row.calls) ? 'No priced usage in this period. Switch to tokens to see activity.' : 'No recorded usage in this period.'}</p>}
  </div>
}

function FeatureBars({ rows, metric }: { rows: UsageRow[]; metric: Metric }) {
  const sorted = [...rows].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0))
  const total = sorted.reduce((sum, row) => sum + Number(row[metric] || 0), 0)
  const max = Math.max(...sorted.map(row => Number(row[metric] || 0)), 0)
  return !rows.length ? <p className="credit-empty">Feature usage will appear after the first AI call.</p> : <ul className="credit-feature-bars">{sorted.map(row => <li key={row.name}>
    <div><span>{row.name}</span><strong>{format(row[metric], metric)}</strong></div>
    <span className="credit-bar-track" role="meter" aria-label={row.name} aria-valuemin={0} aria-valuemax={max || 1} aria-valuenow={Number(row[metric] || 0)} aria-valuetext={format(row[metric], metric)}><span style={{ width: `${max ? Number(row[metric] || 0) / max * 100 : 0}%` }} /></span>
    <div className="credit-row-meta"><span>{number.format(row.calls)} AI calls</span><span>{row[metric] === null ? 'Unpriced' : `${total ? (Number(row[metric]) / total * 100).toFixed(1) : '0'}% of ${metric === 'cost' ? 'priced spend' : 'tokens'}`}</span></div>
  </li>)}</ul>
}

export function AdminAnalyticsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [days, setDays] = useState(30)
  const [metric, setMetric] = useState<Metric>('cost')
  const [user, setUser] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [data, setData] = useState<Usage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void accountFetch(`/api/admin/usage?days=${days}${user ? `&user=${encodeURIComponent(user)}` : ''}`, { signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not load credit usage.'); return result as Usage })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [days, user, version])
  function startRequest() { setLoading(true); setError(''); setData(null) }
  function selectUser(id: string) { if (id !== user) { startRequest(); setUser(id) } }
  const totals = data?.totals
  const selectedUser = data?.users.find(row => row.id === user)
  const users = [...(data?.users || [])].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)).filter(row => `${row.name} ${row.email || ''}`.toLowerCase().includes(search.toLowerCase()))
  const top = [...(data?.features || [])].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0))[0]
  const topShare = totals && top && Number(totals[metric]) > 0 ? Number(top[metric]) / Number(totals[metric]) * 100 : 0
  return <section className="admin-page analytics-overview" aria-labelledby="analytics-title"><div className="admin-shell">
    <header className="credit-header"><h1 id="analytics-title">Analytics</h1><div className="credit-controls"><label><span className="credit-sr-only">Date range</span><select value={days} onChange={event => { startRequest(); setDays(Number(event.target.value)) }}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button type="button" disabled={loading} onClick={() => { startRequest(); setVersion(value => value + 1) }}>Refresh</button></div></header>
    <div className="credit-section-heading"><h2>Credit usage</h2><div className="credit-metric-switch" role="group" aria-label="Usage metric"><button type="button" aria-pressed={metric === 'cost'} onClick={() => setMetric('cost')}>Spend (USD)</button><button type="button" aria-pressed={metric === 'tokens'} onClick={() => setMetric('tokens')}>Tokens</button></div></div>
    <div className="credit-scope"><label htmlFor="credit-user-filter">Usage for</label><select id="credit-user-filter" value={user} onChange={event => selectUser(event.target.value)}><option value="">All users</option>{data?.users.filter(row => row.id).map(row => <option value={row.id!} key={row.id}>{row.name}{row.email ? ` · ${row.email}` : ''}</option>)}{user && !selectedUser && <option value={user}>Selected user</option>}</select>{user && <button type="button" onClick={() => selectUser('')}>Clear</button>}</div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <div aria-busy={loading}>
      <dl className="credit-stats">
        <div><dt>{metric === 'cost' ? 'Estimated credits used' : 'Total tokens used'}</dt><dd>{totals ? <StatValue value={totals[metric] === null && !totals.calls ? 0 : totals[metric]} metric={metric} /> : '—'}</dd><span>{metric === 'cost' ? 'USD · priced calls only' : 'Input, output and cache tokens'}</span></div>
        <div><dt>Average per user</dt><dd>{totals ? <StatValue value={totals.users ? totals[metric] === null ? null : Number(totals[metric]) / totals.users : 0} metric={metric} /> : '—'}</dd><span>{totals ? `${number.format(totals.users)} users with recorded calls` : 'Users with recorded calls'}</span></div>
        <div><dt>AI calls</dt><dd>{totals ? number.format(totals.calls) : '—'}</dd><span>{days} days · {user ? 'Selected user' : 'All users'}</span></div>
      </dl>
      {loading && <p className="credit-loading" role="status">Loading credit usage…</p>}
      {data && <>
        <div className="credit-chart-layout">
          <section className="credit-panel"><header><h3>Usage over time</h3><span>{dateLabel(data.daily[0].date)} – {dateLabel(data.daily[data.daily.length - 1].date)}</span></header><DailyChart rows={data.daily} metric={metric} /></section>
          <aside className="credit-insight"><h3>Largest usage driver</h3>{top && topShare > 0 ? <><strong>{topShare.toFixed(1)}<span>%</span></strong><p>{top.name}</p><span>{format(top[metric], metric)} of {metric === 'cost' ? 'priced spend' : 'total tokens'}{user ? ' for this user' : ''}</span></> : <p>{totals?.calls ? 'Switch to tokens to compare unpriced activity.' : 'No usage recorded yet.'}</p>}</aside>
        </div>
        <div className="credit-breakdowns">
          <section className="credit-panel"><header><h3>Usage by feature</h3><span>{user ? selectedUser?.name || 'Selected user' : 'All users'}</span></header><FeatureBars rows={data.features} metric={metric} /></section>
          <section className="credit-panel credit-users"><header><h3>Usage by user</h3><span>All users · {metric === 'cost' ? 'USD' : 'tokens'}</span></header><label className="credit-user-search"><span className="credit-sr-only">Search users</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setExpanded(false) }} placeholder="Search users" /></label>
            {!users.length ? <p className="credit-empty">{search ? 'No users match your search.' : 'Users will appear after the first AI call.'}</p> : <><ol className="credit-user-list">{users.slice(0, expanded ? users.length : 5).map((row, index) => <li key={row.id || 'deleted'}><span className="credit-rank">{index + 1}</span><div>{row.id ? <button type="button" className="credit-user-name" aria-pressed={user === row.id} onClick={() => selectUser(user === row.id ? '' : row.id!)}>{row.name}</button> : <strong>{row.name}</strong>}<span>{row.email || 'Account removed'}</span></div><div className="credit-user-value"><strong>{format(row[metric], metric)}</strong><span>{number.format(row.calls)} calls</span></div></li>)}</ol>{users.length > 5 && <button type="button" className="credit-show-all" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 5' : `View all ${number.format(users.length)} users`}</button>}</>}
          </section>
        </div>
        <p className="credit-note">Spend estimates use standard Claude API token rates and exclude discounts and taxes. ChatGPT plan calls and models without known pricing have no dollar estimate.{Boolean(totals?.unpriced) && ` ${number.format(totals!.unpriced)} calls are unpriced.`}{Boolean(totals?.unreported) && ` ${number.format(totals!.unreported)} calls did not report tokens.`} Tracking begins after the usage migration is applied; earlier usage is unavailable.</p>
        <p className="credit-updated">Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
      </>}
    </div>
    <ResearchExports />
    <nav aria-label="Analytics reports" className="analytics-reports"><button type="button" className="analytics-report" onClick={() => onNavigate('/admin/analytics/salg-survey')}><span>SALG survey</span><span aria-hidden="true">→</span></button></nav>
  </div></section>
}
