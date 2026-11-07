import type { ReactNode } from 'react'
import type { Account } from '../accounts'
import type { CharacterAppearance } from '../characterAppearance'
import { canTeachCourses } from '../coursePermissions'
import { COMMUNITY_LIBRARY_ENABLED } from '../features'
import { AccountMenu, ProfileIcon } from './AccountMenu'
import './Dashboard.css'
import { InboxPage } from './InboxPage'
import { useInbox } from '../useInbox'

type NavigationIcon = 'inbox' | 'community' | 'dashboard' | 'courses' | 'directory' | 'sessions' | 'accounts' | 'analytics' | 'developer' | 'avatar' | 'settings'
function SidebarIcon({ name }: { name: NavigationIcon }) {
  if (name === 'avatar' || name === 'settings') return <ProfileIcon kind={name} />
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {name === 'inbox' ? <path d="M3 13 6 5h12l3 8v6H3Zm0 0h5l2 3h4l2-3h5" /> : name === 'community' ? <><rect x="3" y="4" width="5" height="16" rx="1" /><path d="M11 4h4v16h-4zM17 5l3-1 3 15-3 1zM3 8h5M11 8h4" /></> : name === 'dashboard' ? <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></> :
      name === 'courses' ? <><path d="M3 4h5a5 5 0 0 1 4 2 5 5 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3Z" /><path d="M12 6v15" /></> :
      name === 'directory' ? <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h.01M7 12h.01M7 16h.01M11 8h6m-6 4h6m-6 4h6" /></> :
      name === 'sessions' ? <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></> :
      name === 'analytics' ? <><path d="M4 3v18h17M8 16v-4m5 4V8m5 8V5" /></> :
      name === 'accounts' ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></> :
      <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" />}
  </svg>
}

export function DashboardShell({ account, appearance, activePage = '/dashboard', onNavigate, onCustomizeAvatar, children }: {
  account: Account; appearance: CharacterAppearance; activePage?: string; onNavigate: (path: string) => void; onCustomizeAvatar: () => void; children: ReactNode
}) {
  const inbox = useInbox(canTeachCourses(account.role) ? account.id : undefined, activePage)
  const pending = inbox.total
  function navigationButton(label: string, icon: NavigationIcon, action: () => void, active = false, count = 0) {
    return <button type="button" className={`dashboard-nav-link${active ? ' is-active' : ''}`} aria-label={count ? `${label}, ${count} ${count === 1 ? 'message' : 'messages'}` : label} aria-current={active ? 'page' : undefined} onClick={action}>
      <SidebarIcon name={icon} /><span className="dashboard-nav-label">{label}</span>
      {count > 0 && <span className="dashboard-inbox-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </button>
  }
  return <div className="dashboard-shell">
    <a className="dashboard-skip-link" href="#dashboard-main">Skip to content</a>
    <aside className="dashboard-sidebar" aria-label="Workspace sidebar">
      <nav className="dashboard-navigation" aria-label="Workspace navigation">
        <div className="dashboard-nav-group">
          {navigationButton('Dashboard', 'dashboard', () => onNavigate('/dashboard'), activePage === '/dashboard')}
          {navigationButton('Courses', 'courses', () => onNavigate('/courses'), (activePage.startsWith('/courses/') && activePage !== '/courses/community') || (!COMMUNITY_LIBRARY_ENABLED && activePage === '/courses'))}
          {COMMUNITY_LIBRARY_ENABLED && <div className="dashboard-course-subnav" aria-label="Course collections">
            {navigationButton(canTeachCourses(account.role) ? 'Teaching' : 'Enrolled', 'courses', () => onNavigate('/courses'), activePage === '/courses')}
            {navigationButton('Community library', 'community', () => onNavigate('/courses/community'), activePage === '/courses/community')}
          </div>}
          {navigationButton('Sessions', 'sessions', () => onNavigate('/sessions'), activePage === '/sessions')}
          {canTeachCourses(account.role) && navigationButton('Inbox', 'inbox', () => onNavigate('/inbox'), activePage === '/inbox', pending)}
        </div>
        {account.role === 'admin' && <div className="dashboard-nav-group dashboard-admin-group">
          <p className="dashboard-nav-heading">Administration</p>
          {navigationButton('Manage accounts', 'accounts', () => onNavigate('/admin'), activePage === '/admin')}
          {navigationButton('All courses', 'directory', () => onNavigate('/admin/all-courses'), /^\/admin\/(?:all-)?courses(?:\/|$)/.test(activePage))}
          {navigationButton('Analytics', 'analytics', () => onNavigate('/admin/analytics'), activePage === '/admin/analytics' || activePage.startsWith('/admin/analytics/'))}
          {account.hosted && navigationButton('AI model', 'settings', () => onNavigate('/admin/ai-model'), activePage === '/admin/ai-model')}
          {navigationButton('Developer tools', 'developer', () => onNavigate('/developer'), activePage === '/developer')}
        </div>}
      </nav>
      <div className="dashboard-sidebar-bottom">
        {navigationButton('Customize Avatar', 'avatar', onCustomizeAvatar, activePage === '/character')}
        {navigationButton('Settings', 'settings', () => onNavigate('/settings'), activePage === '/settings' || activePage === '/profile')}
        <AccountMenu key={`${account.id}:${account.role}`} account={account} appearance={appearance} placement="sidebar" />
      </div>
    </aside>
    <div className="dashboard-content">
      <div id="dashboard-main" tabIndex={-1}>{activePage === '/inbox' && canTeachCourses(account.role) ? <InboxPage inbox={inbox} onNavigate={onNavigate} /> : children}</div>
    </div>
  </div>
}
