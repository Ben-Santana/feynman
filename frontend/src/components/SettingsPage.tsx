import { useState } from 'react'
import type { Account, AccountAuthMode } from '../accounts'
import type { CharacterAppearance } from '../characterAppearance'
import { matchingSettings, type SettingsCategory } from '../settingsSearch'
import { DisplaySettings } from './DisplaySettings'
import { AISettings } from './AISettings'
import { ProfileIcon } from './AccountMenu'
import { ProfilePage } from './ProfilePage'
import './SettingsPage.css'

export function SettingsPage({ account, authMode, onProfileUpdated, appearance }: {
  account: Account; authMode: AccountAuthMode; onProfileUpdated: (account: Account) => void; appearance: CharacterAppearance
}) {
  const [category, setCategory] = useState<SettingsCategory | 'all'>('profile')
  const [query, setQuery] = useState('')
  const [aiVisited, setAIVisited] = useState(false)
  const searching = Boolean(query.trim())
  const profileCount = matchingSettings('profile', query).length
  const aiCount = matchingSettings('ai', query).length
  const displayCount = matchingSettings('display', query).length
  const showProfile = (category === 'all' || category === 'profile') && profileCount > 0
  const showDisplay = (category === 'all' || category === 'display') && displayCount > 0
  const showAI = (category === 'all' || category === 'ai') && aiCount > 0
  const count = (showProfile ? profileCount : 0) + (showDisplay ? displayCount : 0) + (showAI ? aiCount : 0)

  function updateQuery(value: string) {
    setQuery(value)
    if (value.trim() && matchingSettings('ai', value).length) setAIVisited(true)
    setCategory(value.trim() ? 'all' : category === 'all' ? 'profile' : category)
  }

  return <main className="settings-page" aria-labelledby="settings-title">
    <header className="settings-heading"><h1 id="settings-title">Settings</h1></header>
    <div className="settings-layout">
      <aside className="settings-sidebar" aria-label="Settings sidebar">
        <div className="settings-search">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input type="search" aria-label="Search settings" placeholder="Search settings" value={query} onChange={event => updateQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') updateQuery('') }} />
        </div>
        <nav className="settings-categories" aria-label="Settings categories">
          {searching && <button type="button" aria-current={category === 'all' ? 'true' : undefined} onClick={() => setCategory('all')}><ProfileIcon kind="settings" /><span>All settings</span><small>{profileCount + displayCount + aiCount}</small></button>}
          <button type="button" aria-current={category === 'profile' ? 'true' : undefined} onClick={() => setCategory('profile')}><ProfileIcon kind="profile" /><span>Profile</span>{searching && <small>{profileCount}</small>}</button>
          <button type="button" aria-current={category === 'display' ? 'true' : undefined} onClick={() => setCategory('display')}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></svg><span>Display</span>{searching && <small>{displayCount}</small>}</button>
          <button type="button" aria-current={category === 'ai' ? 'true' : undefined} onClick={() => { setCategory('ai'); setAIVisited(true) }}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></svg><span>AI settings</span>{searching && <small>{aiCount}</small>}</button>
        </nav>
      </aside>
      <div className="settings-content">
        {searching && <p className="settings-result-count" role="status">{count} {count === 1 ? 'setting' : 'settings'} found</p>}
        {count === 0 && <div className="settings-empty"><h2>No settings found</h2><p>Try another search or choose a different section.</p><button type="button" onClick={() => updateQuery('')}>Clear search</button></div>}
        <div hidden={!showProfile}><ProfilePage account={account} authMode={authMode} onProfileUpdated={onProfileUpdated} appearance={appearance} query={query} /></div>
        <div hidden={!showDisplay}><DisplaySettings query={query} /></div>
        <div hidden={!showAI}>{(showAI || aiVisited) && <AISettings query={query} active={showAI} />}</div>
      </div>
    </div>
  </main>
}
