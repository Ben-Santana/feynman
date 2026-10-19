import { useState, type FormEvent } from 'react'
import { saveAccountDisplayName, updateAccountPassword, type Account, type AccountAuthMode } from '../accounts'
import type { CharacterAppearance } from '../characterAppearance'
import { Bloub } from './Bloub'
import { matchesSetting } from '../settingsSearch'
import './ProfilePage.css'
import { downloadSignedConsent } from '../accounts'

function accountDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ProfilePage({ account, authMode, onProfileUpdated, appearance, query = '' }: {
  account: Account; authMode: AccountAuthMode; onProfileUpdated: (account: Account) => void
  appearance: CharacterAppearance
  query?: string
}) {
  const [draftName, setDraftName] = useState(account.display_name)
  const [savedName, setSavedName] = useState(account.display_name)
  const [savingName, setSavingName] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')
  const changed = draftName.trim() !== savedName
  const showName = matchesSetting('displayName', query)
  const showEmail = matchesSetting('email', query)

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (savingName) return
    setSavingName(true); setProfileError(''); setProfileNotice('')
    try {
      const updated = await saveAccountDisplayName(account, draftName)
      onProfileUpdated(updated)
      setDraftName(updated.display_name); setSavedName(updated.display_name)
      setProfileNotice('Your profile has been saved.')
    } catch (reason) { setProfileError(reason instanceof Error ? reason.message : 'Could not save your profile.') }
    finally { setSavingName(false) }
  }
  async function savePassword(event: FormEvent) {
    event.preventDefault()
    if (savingPassword) return
    setPasswordError(''); setPasswordNotice('')
    if (password !== confirmation) { setPasswordError('The passwords do not match.'); return }
    setSavingPassword(true)
    try {
      await updateAccountPassword(password)
      setPassword(''); setConfirmation(''); setShowPassword(false)
      setPasswordNotice('Your password has been updated.')
    } catch (reason) { setPasswordError(reason instanceof Error ? reason.message : 'Could not update your password.') }
    finally { setSavingPassword(false) }
  }

  return <section className="profile-page" aria-labelledby="profile-page-title">
    <header className="profile-page-heading"><h2 id="profile-page-title">Profile</h2></header>
    <div className="profile-page-layout">
      <div className="profile-page-forms">
        {!query && <section className="profile-page-card" aria-labelledby="profile-consent-title">
          <div className="profile-page-section-heading"><h3 id="profile-consent-title">Research consent</h3></div>
          <button className="profile-page-secondary" onClick={() => { void downloadSignedConsent().catch(reason => setProfileError(reason.message)) }}>Download signed agreement</button>
        </section>}
        <section className="profile-page-card" aria-labelledby="profile-details-title" hidden={!showName && !showEmail}>
          <div className="profile-page-section-heading"><h3 id="profile-details-title">Personal details</h3></div>
          <form onSubmit={event => { event.preventDefault(); if (showName) void saveProfile(event) }}>
            <div className="profile-page-field" hidden={!showName}>
            <label htmlFor="profile-display-name">Display name</label>
            <input id="profile-display-name" autoComplete="nickname" value={draftName} required maxLength={100} disabled={savingName} aria-describedby="profile-name-hint" onChange={event => { setDraftName(event.target.value); setProfileError(''); setProfileNotice('') }} />
            <p id="profile-name-hint" className="profile-page-hint">Use your name or a nickname. Up to 100 characters.</p>
            </div>
            <div className="profile-page-field" hidden={!showEmail}>
            <label htmlFor="profile-email">Email</label>
            <input id="profile-email" type="email" value={account.email} readOnly aria-describedby="profile-email-hint" />
            <p id="profile-email-hint" className="profile-page-hint">Your email is linked to your sign-in account.</p>
            </div>
            <div className="profile-page-form-actions" hidden={!showName}>
              <button type="button" className="profile-page-secondary" disabled={savingName || !changed} onClick={() => { setDraftName(savedName); setProfileError(''); setProfileNotice('') }}>Discard changes</button>
              <button type="submit" className="profile-page-primary" disabled={savingName || !changed || !draftName.trim()}>{savingName ? 'Saving…' : 'Save changes'}</button>
            </div>
            {profileNotice && <p className="profile-page-feedback" role="status">{profileNotice}</p>}
            {profileError && <p className="profile-page-feedback account-error" role="alert">{profileError}</p>}
          </form>
        </section>
        <section className="profile-page-card" aria-labelledby="profile-security-title" hidden={!matchesSetting('password', query)}>
          <div className="profile-page-section-heading"><h3 id="profile-security-title">Sign-in & security</h3></div>
          {authMode === 'email' ? <form onSubmit={event => void savePassword(event)}>
            <label htmlFor="profile-password">New password</label>
            <input id="profile-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} value={password} disabled={savingPassword} aria-describedby="profile-password-hint" onChange={event => { setPassword(event.target.value); setPasswordError(''); setPasswordNotice('') }} />
            <p id="profile-password-hint" className="profile-page-hint">Use at least 12 characters.</p>
            <label htmlFor="profile-confirm-password">Confirm new password</label>
            <input id="profile-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} value={confirmation} disabled={savingPassword} onChange={event => { setConfirmation(event.target.value); setPasswordError(''); setPasswordNotice('') }} />
            <label className="profile-page-checkbox"><input type="checkbox" checked={showPassword} disabled={savingPassword} onChange={event => setShowPassword(event.target.checked)} />Show passwords</label>
            <div className="profile-page-form-actions"><button type="submit" className="profile-page-primary" disabled={savingPassword || password.length < 12 || !confirmation}>{savingPassword ? 'Updating…' : 'Update password'}</button></div>
            {passwordNotice && <p className="profile-page-feedback" role="status">{passwordNotice}</p>}
            {passwordError && <p className="profile-page-feedback account-error" role="alert">{passwordError}</p>}
          </form> : <p className="profile-page-managed">WPI manages your password and multifactor authentication. Update your credentials through your WPI account.</p>}
        </section>
      </div>
      <aside className="profile-page-aside" aria-label="Account overview" hidden={!matchesSetting('accountDetails', query)}>
        <section className="profile-page-card profile-page-overview">
          <div className="profile-page-character" aria-hidden="true"><Bloub mode="studio" appearance={appearance} expression="attentive" showControls={false} /></div>
          <h3>{account.display_name}</h3><p>{account.email}</p><span className="profile-page-role">{account.role}</span>
          <dl><div><dt>Member since</dt><dd>{accountDate(account.created_at)}</dd></div><div><dt>Last sign-in</dt><dd>{accountDate(account.last_login_at)}</dd></div><div><dt>Sign-in method</dt><dd>{authMode === 'email' ? 'Email & password' : 'WPI single sign-on'}</dd></div></dl>
          <p className="profile-page-hint">Your account role is managed by an administrator.</p>
        </section>
      </aside>
    </div>
  </section>
}
