import type { ReactNode } from 'react'
import type { Account } from '../accounts'
import { AccountMenu, ProfileIcon } from './AccountMenu'
import './Dashboard.css'

type NavigationIcon = 'dashboard' | 'courses' | 'sessions' | 'accounts' | 'developer' | 'avatar' | 'settings'
function SidebarIcon({ name }: { name: NavigationIcon }) {
  if (name === 'avatar' || name === 'settings') return <ProfileIcon kind={name} />
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {name === 'dashboard' ? <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></> :
      name === 'courses' ? <><path d="M3 4h5a5 5 0 0 1 4 2 5 5 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3Z" /><path d="M12 6v15" /></> :
      name === 'sessions' ? <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></> :
      name === 'accounts' ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></> :
      <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" />}
  </svg>
}

export function DashboardShell({ account, activePage = '/dashboard', onNavigate, onCustomizeAvatar, children }: {
  account: Account; activePage?: string; onNavigate: (path: string) => void; onCustomizeAvatar: () => void; children: ReactNode
}) {
  function navigationButton(label: string, icon: NavigationIcon, action: () => void, active = false) {
    return <button type="button" className={`dashboard-nav-link${active ? ' is-active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} onClick={action}>
      <SidebarIcon name={icon} /><span className="dashboard-nav-label">{label}</span>
    </button>
  }
  return <div className="dashboard-shell">
    <a className="dashboard-skip-link" href="#dashboard-main">Skip to content</a>
    <aside className="dashboard-sidebar" aria-label="Workspace sidebar">
      <nav className="dashboard-navigation" aria-label="Workspace navigation">
        <div className="dashboard-nav-group">
          <p className="dashboard-nav-heading">Workspace</p>
          {navigationButton('Dashboard', 'dashboard', () => onNavigate('/dashboard'), activePage === '/dashboard')}
          {account.role !== 'admin' && navigationButton('Courses', 'courses', () => onNavigate('/courses'), activePage.startsWith('/courses'))}
          {navigationButton('Sessions', 'sessions', () => onNavigate('/sessions'), activePage === '/sessions')}
        </div>
        {account.role === 'admin' && <div className="dashboard-nav-group dashboard-admin-group">
          <p className="dashboard-nav-heading">Administration</p>
          {navigationButton('Manage accounts', 'accounts', () => onNavigate('/admin'), activePage === '/admin')}
          {navigationButton('View courses', 'courses', () => onNavigate('/admin/courses'), activePage === '/admin/courses' || activePage.startsWith('/admin/courses/'))}
          {navigationButton('Developer tools', 'developer', () => onNavigate('/developer'), activePage === '/developer')}
        </div>}
      </nav>
      <div className="dashboard-sidebar-bottom">
        {navigationButton('Customize Avatar', 'avatar', onCustomizeAvatar, activePage === '/character')}
        {navigationButton('Settings', 'settings', () => onNavigate('/settings'), activePage === '/settings' || activePage === '/profile')}
        <AccountMenu key={account.id} account={account} placement="sidebar" />
      </div>
    </aside>
    <div className="dashboard-content">
      <div id="dashboard-main" tabIndex={-1}>{children}</div>
    </div>
  </div>
}
