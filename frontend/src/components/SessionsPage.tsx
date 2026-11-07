import { useState } from 'react'
import { activityDate, sessionProgress } from '../dashboardData'
import type { Concept, Session } from '../learningFlow'
import { sessionComplete } from '../learningFlow'
import type { SavedSession } from '../learningStore'
import { CollectionAddButton, CollectionSearch } from './CollectionSearch'
import { LibraryEmptyState } from './LibraryEmptyState'
import './SessionsPage.css'

type SessionRecord = SavedSession<Concept, Session>
const completed = (record: SessionRecord) => record.started && Boolean(record.reportFinishedAt || sessionComplete(record.concepts))
const sessionTitle = (record: SessionRecord) => record.title || 'Untitled session'

function SessionStatus({ record }: { record: SessionRecord }) {
  if (completed(record)) return <span className="session-row-status"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 10.5 4 4 8-9" /></svg>Complete</span>
  if (!record.started) return <span className="session-row-status">Finish setup</span>
  const progress = sessionProgress(record)
  return <span className="session-row-status"><span className="dashboard-session-progress"><span>{progress}%</span><span className="dashboard-progress-track" role="progressbar" aria-label={`${sessionTitle(record)} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></span></span></span>
}

export function SessionsPage({ sessions, onCreateSession, onOpenSession, error }: {
  sessions: SessionRecord[]; onCreateSession: () => void; onOpenSession: (record: SessionRecord) => void; error: string
}) {
  const [filter, setFilter] = useState<'current' | 'completed'>('current')
  const [search, setSearch] = useState('')
  const currentSessions = sessions.filter(record => !completed(record))
  const completedSessions = sessions.filter(completed)
  const filteredSessions = (filter === 'current' ? currentSessions : completedSessions).filter(record => sessionTitle(record).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  return <section className="dashboard-sessions" aria-labelledby="sessions-title">
    <h1 id="sessions-title" className="sr-only">My Sessions</h1>
    <div className="collection-toolbar dashboard-session-actions">
      <CollectionSearch label="Search sessions" value={search} onChange={setSearch} />
      <CollectionAddButton label="Create custom session" text="Create" onClick={onCreateSession} />
    </div>
    {sessions.length > 0 && <div className="sessions-tabs" role="group" aria-label="Filter sessions">
      <button type="button" aria-pressed={filter === 'current'} onClick={() => setFilter('current')}>Current<span>{currentSessions.length}</span></button>
      <button type="button" aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Completed<span>{completedSessions.length}</span></button>
    </div>}
    {filteredSessions.length ? <ul className="sessions-rows">{filteredSessions.map(record => {
      const concepts = record.concepts.length
      return <li key={record.id}><button type="button" className="session-row" onClick={() => onOpenSession(record)}>
        <span className="session-row-copy">
          <strong>{sessionTitle(record)}</strong>
          <span>{record.assignment?.courseName || 'Custom session'}<span className="session-row-concepts"><span className="dashboard-meta-dot" aria-hidden="true">·</span>{concepts} {concepts === 1 ? 'concept' : 'concepts'}</span><span className="dashboard-meta-dot" aria-hidden="true">·</span><time dateTime={new Date(record.updatedAt).toISOString()}>{activityDate(record.updatedAt)}</time></span>
        </span>
        <SessionStatus record={record} />
        <svg className="session-row-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
      </button></li>
    })}</ul> : !error && <LibraryEmptyState
      kind="sessions"
      title={search.trim() ? 'No matching sessions' : !sessions.length ? 'No sessions yet' : filter === 'completed' ? 'No completed sessions yet' : 'No current sessions'}
      action={search.trim() ? { label: 'Clear search', onClick: () => setSearch('') } : filter === 'completed' && sessions.length ? { label: 'View current sessions', onClick: () => setFilter('current') } : { label: 'Start session', onClick: onCreateSession }}
    />}
    {error && <p className="chat-error" role="alert">{error}</p>}
  </section>
}
