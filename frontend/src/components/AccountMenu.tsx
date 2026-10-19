import { useEffect, useId, useRef, useState } from 'react'
import { activateAccount, supabase, type Account } from '../accounts'
import { flushSessionSaves } from '../learningStore'

export function ProfileIcon({ kind }: { kind: 'profile' | 'avatar' | 'settings' | 'accounts' | 'developer' | 'sign-out' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'profile' ? <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></> :
      kind === 'avatar' ? <><path d="M8 3h8a2 2 0 0 1 1.7 1l4 7a2 2 0 0 1 0 2l-4 7a2 2 0 0 1-1.7 1H8a2 2 0 0 1-1.7-1l-4-7a2 2 0 0 1 0-2l4-7A2 2 0 0 1 8 3Z" /><path d="M9 10v4m6-4v4" /></> :
      kind === 'settings' ? <><path d="m9.5 3-.5 2-1.6.9-2-.6-2.5 4.3L4.4 11v1.8l-1.5 1.4 2.5 4.3 2-.6L9 19l.5 2h5l.5-2 1.6-.9 2 .6 2.5-4.3-1.5-1.4v-1.8l1.5-1.4-2.5-4.3-2 .6L15 5l-.5-2z" /><circle cx="12" cy="12" r="3" /></> :
      kind === 'accounts' ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></> :
      kind === 'developer' ? <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" /> :
      <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m5-12 4 4-4 4m-7-4h11" />}
  </svg>
}

export function AccountMenu({ account, placement = 'floating' }: { account: Account; placement?: 'floating' | 'sidebar' }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const displayName = account.display_name.trim() || account.email.split('@')[0]
  const initials = displayName.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase()

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    const dismissOnFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const dismissOnNavigation = () => setOpen(false)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    document.addEventListener('focusin', dismissOnFocus)
    window.addEventListener('popstate', dismissOnNavigation)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); document.removeEventListener('focusin', dismissOnFocus); window.removeEventListener('popstate', dismissOnNavigation) }
  }, [open])

  async function signOut() {
    setBusy(true); setError('')
    try {
      // Recovery is written before cloud saves; failed saves survive a logout.
      await flushSessionSaves().catch(() => {})
      const { error: reason } = await supabase().auth.signOut({ scope: 'local' })
      if (reason) throw reason
      activateAccount(null)
      window.history.replaceState(null, '', '/')
    } catch (reason) { setError((reason as Error).message); setBusy(false) }
  }
  return <div className={`account-menu${placement === 'sidebar' ? ' account-menu-sidebar' : ''}`} ref={root} onKeyDown={event => { if (open && event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() } }}>
    <button ref={trigger} type="button" className="profile-trigger" aria-label="Profile" title="Profile" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(value => !value)}>
      <span className="profile-avatar" aria-hidden="true">{initials || <ProfileIcon kind="profile" />}</span>
      {placement === 'sidebar' && <span className="profile-trigger-copy"><strong>{displayName}</strong><small>{account.email}</small></span>}
      <svg className="profile-chevron" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {open && <div className="profile-panel" id={panelId} aria-label="Profile options">
      <div className="profile-account-type">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {account.role === 'admin' ? <><path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></> : account.role === 'instructor' ? <><rect x="7" y="3" width="14" height="12" rx="2" /><circle cx="6" cy="14" r="3" /><path d="M1 22v-1a5 5 0 0 1 10 0v1m2-15h4m-4 4h4" /></> : <><path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v6c4 3 8 3 12 0v-6m4-2v7" /></>}
        </svg>
        <span>{account.role}</span>
      </div>
      <div className="profile-actions profile-footer"><button className="profile-sign-out" type="button" disabled={busy} onClick={() => void signOut()}><ProfileIcon kind="sign-out" /><span>{busy ? 'Logging out…' : 'Log out'}</span></button></div>
      {error && <p className="account-error profile-notice" role="alert">{error}</p>}
    </div>}
  </div>
}
