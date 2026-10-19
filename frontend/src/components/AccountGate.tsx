import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { accountFetch, activateAccount, completeAccountCallback, currentAccount, loadAccountAuthMode, navigateAccountPage, requestPasswordReset, savePendingAccountRole, signInWithEmail, signInWithWpi, signUpWithEmail, supabase, updateAccountPassword, type Account, type AccountAuthMode, type SignupRole } from '../accounts'
import { Bloub } from './Bloub'
import { CornerDrops } from './CornerDrops'
import { AccountLoading, LoadingAnimation } from './AccountLoading'
import './Accounts.css'
import { ConsentAgreement } from './ConsentAgreement'
import { downloadSignedConsent } from '../accounts'

let callback: { href: string; promise: Promise<void> } | undefined
function AccountAvatar() {
  return <div className="account-avatar" aria-hidden="true"><Bloub mode="studio" expression="attentive" showControls={false} followPointer /></div>
}

function AccountRoleSelector({ role, disabled, onChange }: { role: string; disabled: boolean; onChange: (role: SignupRole) => void }) {
  return <fieldset className="account-role" disabled={disabled}>
    <legend>Are you a...</legend>
    <div className="account-role-options">
      {(['instructor', 'student'] as const).map(option => <label key={option}>
        <input type="radio" name="account-type" value={option} checked={role === option} onChange={() => onChange(option)} />
        <span>{option === 'instructor' ? 'Instructor' : 'Student'}</span>
      </label>)}
    </div>
  </fieldset>
}

export function AccountGate({ children }: { children: (account: Account, onProfileUpdated: (account: Account) => void, authMode: AccountAuthMode) => ReactNode }) {
  const [page, setPage] = useState(window.location.pathname.replace(/\/$/, '') || '/')
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [authMode, setAuthMode] = useState<AccountAuthMode | null>(null)
  const [formMode, setFormMode] = useState<'sign-in' | 'sign-up' | 'reset-request'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [signupRole, setSignupRole] = useState<SignupRole>('student')
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const editingPending = Boolean(account && !account.approved && editingAccountId === account.id)
  const [notice, setNotice] = useState('')
  const [resettingPassword, setResettingPassword] = useState(window.location.pathname === '/account/reset-password')
  const [hasSession, setHasSession] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    const onPopState = () => setPage(window.location.pathname.replace(/\/$/, '') || '/')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    if (loading || resettingPassword || page === '/' || page === '/account/callback') return
    if (account && !account.approved && page !== '/account/pending') navigateAccountPage('/account/pending')
    else if (account?.approved && (page === '/account/login' || page === '/account/pending')) navigateAccountPage('/dashboard')
    else if (!account && page !== '/account/login') navigateAccountPage('/account/login')
  }, [account, loading, page, resettingPassword])
  useEffect(() => {
    let disposed = false
    let waitingForApproval = false
    async function refresh() {
      const ticket = ++generation.current
      try {
        const mode = await loadAccountAuthMode()
        const { data, error: sessionError } = await supabase().auth.getSession()
        if (!disposed && ticket === generation.current) { setAuthMode(mode); setHasSession(Boolean(data.session)) }
        if (sessionError) throw sessionError
        if (!data.session) {
          if (!disposed && ticket === generation.current) { waitingForApproval = false; activateAccount(null); setAccount(null) }
          return
        }
        const response = await accountFetch('/api/account', { signal: AbortSignal.timeout(15000) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not load your account.')
        if (!disposed && ticket === generation.current) { waitingForApproval = result.approved !== true; activateAccount(result.approved === true && !result.consent_required ? result : null); setAccount(result); setError('') }
      } catch (reason) {
        if (!disposed && ticket === generation.current) {
          activateAccount(null); setAccount(null)
          setError(reason instanceof Error ? reason.message : 'Could not verify your login.')
        }
      } finally { if (!disposed && ticket === generation.current) setLoading(false) }
    }
    let unsubscribe = () => {}
    try {
      const { data } = supabase().auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || (session && currentAccount()?.id && session.user.id !== currentAccount()?.id)) {
          ++generation.current; activateAccount(null); setAccount(null)
        }
        // Do not call Supabase methods synchronously inside its auth listener.
        if (event !== 'INITIAL_SESSION') queueMicrotask(() => { if (!disposed) void refresh() })
      })
      unsubscribe = () => data.subscription.unsubscribe()
      const url = new URL(window.location.href)
      if (url.pathname === '/account/callback' || (url.pathname === '/account/reset-password' && (url.searchParams.has('code') || url.searchParams.has('error')))) {
        if (callback?.href !== url.href) callback = { href: url.href, promise: completeAccountCallback(url) }
        void callback.promise.then(refresh).catch(reason => { if (!disposed) { setError(reason.message); setResettingPassword(false); setLoading(false); window.history.replaceState(null, '', '/') } })
      } else void refresh()
    } catch (reason) { queueMicrotask(() => { if (!disposed) { setError((reason as Error).message); setLoading(false) } }) }
    const interval = window.setInterval(() => { if (!disposed && document.visibilityState === 'visible' && waitingForApproval) void refresh() }, 15000)
    const focus = () => { void refresh() }
    window.addEventListener('focus', focus)
    return () => { disposed = true; unsubscribe(); window.clearInterval(interval); window.removeEventListener('focus', focus) }
  }, [attempt])
  async function submitEmail(event: FormEvent) {
    event.preventDefault(); setSigningIn(true); setError(''); setNotice('')
    try {
      if (editingPending && account) {
        const id = account.id
        ++generation.current
        const role = await savePendingAccountRole(signupRole)
        setAccount(current => current?.id === id && !current.approved ? { ...current, role } : current)
        setEditingAccountId(null)
        setNotice('Account type saved.')
      } else if (formMode === 'reset-request') {
        await requestPasswordReset(email)
        setNotice('If an account exists for this address, you will receive a password reset link. Open it in this browser.')
      } else if (formMode === 'sign-up') {
        if (password !== confirmPassword) throw new Error('The passwords do not match.')
        await signUpWithEmail(email, password, signupRole)
      } else await signInWithEmail(email, password)
      setPassword(''); setConfirmPassword('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sign in. Please try again.') }
    finally { setSigningIn(false) }
  }
  function changeForm(mode: typeof formMode) {
    setFormMode(mode); setError(''); setNotice(''); setPassword(''); setConfirmPassword('')
  }
  if (!loading && account?.consent_required && !resettingPassword) return <ConsentAgreement key={account.id} onSigned={() => { setLoading(true); setAttempt(value => value + 1) }} />
  if (!loading && account && account.approved !== true && !resettingPassword && !editingPending) return <main className="account-login account-pending"><section aria-labelledby="pending-title">
    <div className="account-card">
      <AccountAvatar />
      <header className="account-heading"><h1 id="pending-title">Pending approval</h1><p>An admin needs to approve your account before you can start learning.</p></header>
      {notice && <p className="account-notice" role="status">{notice}</p>}
      <div className="account-links"><button className="account-secondary" type="button" onClick={() => { void downloadSignedConsent().catch(reason => setError(reason.message)) }}>Download signed agreement</button></div>
      <button type="button" disabled={signingIn} onClick={() => {
        setSigningIn(true); setError('')
        void supabase().auth.signOut().then(({ error }) => { if (error) throw error }).catch(reason => setError(reason.message)).finally(() => setSigningIn(false))
      }}>Sign out</button>
      <div className="account-links"><button className="account-secondary" type="button" disabled={signingIn} onClick={() => {
        setSignupRole(account.role === 'instructor' ? 'instructor' : 'student')
        setEmail(account.email); changeForm('sign-up'); setEditingAccountId(account.id)
      }}>Make changes to account</button></div>
      {error && <p className="account-error" role="alert">{error}</p>}
    </div>
  </section></main>
  if (page === '/') return <main className="bg-background text-foreground"><section className="home-hero">
    <div className="home-hero-art"><Bloub mode="hero" /></div><CornerDrops />
    <div className="home-hero-copy"><div className="home-hero-content">
      <p className="font-display text-sm font-medium tracking-[0.2em] text-primary uppercase">Feynman</p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Learn by teaching.</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Teach your AI classmate what you have been learning, one concept at a time.</p>
      <button className="home-chat-link" onClick={() => navigateAccountPage(account ? '/dashboard' : '/account/login')}>Start learning →</button>
    </div></div>
  </section></main>
  if (loading) return <AccountLoading />
  if (resettingPassword && authMode === 'email') return <main className="account-login"><section aria-labelledby="account-title">
    <div className="account-card">
      <AccountAvatar />
      <header className="account-heading"><h1 id="account-title">A fresh start.</h1><p>Choose a new password for your account.</p></header>
      {hasSession ? <form onSubmit={event => {
        event.preventDefault(); setSigningIn(true); setError('')
        void (async () => {
          try {
            if (password !== confirmPassword) throw new Error('The passwords do not match.')
            await updateAccountPassword(password)
            setPassword(''); setConfirmPassword(''); setResettingPassword(false)
            navigateAccountPage('/dashboard'); setAttempt(value => value + 1)
          } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update your password.') }
          finally { setSigningIn(false) }
        })()
      }}>
        <label>New password<input type="password" autoComplete="new-password" required minLength={12} value={password} disabled={signingIn} onChange={event => setPassword(event.target.value)} /></label>
        <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} disabled={signingIn} onChange={event => setConfirmPassword(event.target.value)} /></label>
        <button disabled={signingIn}>{signingIn ? 'Saving…' : 'Save password'}</button>
      </form> : <p>This reset link has expired. Request a new link from the sign-in screen.</p>}
      <div className="account-links"><button className="account-secondary" type="button" disabled={signingIn} onClick={() => { setResettingPassword(false); setPassword(''); setConfirmPassword(''); navigateAccountPage('/account/login') }}>Back to sign in</button></div>
      {error && <p className="account-error" role="alert">{error}</p>}
    </div>
  </section></main>
  if (account && authMode && !editingPending) return children(account, updated => {
    const current = currentAccount()
    if (!current || current.id !== updated.id) return
    const next = { ...current, display_name: updated.display_name, updated_at: updated.updated_at }
    activateAccount(next); setAccount(next)
  }, authMode)
  return <main className="account-login"><section aria-labelledby="account-title">
    <div className="account-card">
      <AccountAvatar />
      <header className="account-heading">
        <h1 id="account-title">{editingPending ? 'Edit account.' : formMode === 'sign-up' ? 'Create an account.' : formMode === 'reset-request' ? 'Forgot your password?' : 'Welcome back.'}</h1>
        {formMode === 'reset-request' && <p>We’ll send a reset link to your email.</p>}
      </header>
      {(authMode === 'email' || editingPending) && <>
        <form onSubmit={event => void submitEmail(event)}>
          {formMode === 'sign-up' && <AccountRoleSelector role={signupRole} disabled={signingIn} onChange={setSignupRole} />}
          <label>Email<input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required maxLength={254} value={email} readOnly={editingPending} disabled={signingIn} onChange={event => setEmail(event.target.value)} /></label>
          {!editingPending && formMode !== 'reset-request' && <label>Password<input type="password" autoComplete={formMode === 'sign-up' ? 'new-password' : 'current-password'} required minLength={formMode === 'sign-up' ? 12 : undefined} value={password} disabled={signingIn} onChange={event => setPassword(event.target.value)} /></label>}
          {!editingPending && formMode === 'sign-up' && <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} disabled={signingIn} onChange={event => setConfirmPassword(event.target.value)} /></label>}
          <button disabled={signingIn}>{signingIn ? <LoadingAnimation label="Submitting" compact /> : editingPending ? 'Save changes' : formMode === 'sign-up' ? 'Create account' : formMode === 'reset-request' ? 'Send reset link' : 'Sign in'}</button>
        </form>
        {!editingPending && formMode === 'sign-up' && <small className="account-hint">Use at least 12 characters for your password.</small>}
        <div className="account-links">
          {editingPending ? <button className="account-secondary" type="button" disabled={signingIn} onClick={() => { setEditingAccountId(null); setError(''); setNotice('') }}>Back to pending approval</button> : <button className="account-secondary" type="button" disabled={signingIn} onClick={() => changeForm(formMode === 'sign-in' ? 'sign-up' : 'sign-in')}>{formMode === 'sign-in' ? 'Create an account' : 'Back to sign in'}</button>}
          {formMode === 'sign-in' && <button className="account-secondary" type="button" disabled={signingIn} onClick={() => changeForm('reset-request')}>Forgot password?</button>}
        </div>
      </>}
      {authMode === 'wpi' && !editingPending && <>
        <p>Sign in with your WPI account to save your learning and customize your classmate.</p>
        <button type="button" disabled={signingIn} onClick={() => { setSigningIn(true); setError(''); void signInWithWpi().catch(reason => { setError(reason.message); setSigningIn(false) }) }}>{signingIn ? 'Opening WPI sign-in…' : 'Continue with WPI'}</button>
        <small>WPI handles your password and multifactor authentication. Use the same WPI email as your existing Feynman account to keep your saved work.</small>
      </>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
      {error && <><p className="account-error" role="alert">{error}</p><button type="button" onClick={() => { setLoading(true); setSigningIn(false); setAttempt(value => value + 1) }}>Retry checking login</button></>}
    </div>
  </section></main>
}
