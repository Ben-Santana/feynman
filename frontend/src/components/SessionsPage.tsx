import { useId, useState, type ReactNode } from 'react'
import type { Concept, Session } from '../learningFlow'
import { sessionComplete } from '../learningFlow'
import type { SavedSession } from '../learningStore'

type SessionRecord = SavedSession<Concept, Session>
export function SessionsPage({ sessions, onCreateSession, renderSession, error }: {
  sessions: SessionRecord[]; onCreateSession: () => void; renderSession: (record: SessionRecord) => ReactNode; error: string
}) {
  const [filter, setFilter] = useState<'current' | 'completed'>('current')
  const [search, setSearch] = useState('')
  const searchId = useId()
  const completed = (record: SessionRecord) => record.started && sessionComplete(record.concepts)
  const currentSessions = sessions.filter(record => !completed(record))
  const completedSessions = sessions.filter(completed)
  const filteredSessions = (filter === 'current' ? currentSessions : completedSessions).filter(record => (record.title || 'Untitled session').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  return <section className="dashboard-sessions" aria-labelledby="sessions-title">
    <div className="dashboard-session-heading">
      <div><h1 id="sessions-title">Your sessions</h1><p>Continue a conversation or start something new.</p></div>
      <button type="button" className="dashboard-new-session" onClick={onCreateSession}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>Custom Session</button>
    </div>
    {sessions.length > 0 && <div className="dashboard-session-toolbar">
      <div className="dashboard-session-filters" role="group" aria-label="Filter sessions">
        <button type="button" aria-pressed={filter === 'current'} onClick={() => setFilter('current')}>Current<span>{currentSessions.length}</span></button>
        <button type="button" aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Completed<span>{completedSessions.length}</span></button>
      </div>
      <div className="dashboard-session-search"><label className="sr-only" htmlFor={searchId}>Search sessions</label><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg><input id={searchId} type="search" placeholder="Search sessions" value={search} onChange={event => setSearch(event.target.value)} /></div>
    </div>}
    <div className="sessions-list dashboard-session-list">
      {filteredSessions.length ? filteredSessions.map(renderSession) : sessions.length > 0 && <p className="dashboard-session-empty" role="status">{search.trim() ? 'No matching sessions.' : filter === 'completed' ? 'No completed sessions yet.' : 'No current sessions.'}</p>}
    </div>
    {error && <p className="chat-error" role="alert">{error}</p>}
  </section>
}
