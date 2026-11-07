import { ActionMenu } from './ActionMenu'
import { CollectionSearch } from './CollectionSearch'
import { useEffect, useState } from 'react'
import { accountFetch, type Account, type UserRole } from '../accounts'
import { LoadingAnimation, LoadingScreen } from './AccountLoading'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './useToast'
import './AdminPage.css'
import { downloadSignedConsent } from '../accounts'

type UserPage = { users: Account[]; total: number; page: number; pageSize: number }
export function AdminPage({ targetId, onNavigate }: { targetId: string | null; onNavigate: (path: string) => void }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<UserPage | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [grantTarget, setGrantTarget] = useState<Account | null>(null)
  const [grantAmount, setGrantAmount] = useState('')
  const [grantError, setGrantError] = useState('')
  const [granting, setGranting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) { setError(''); setResult(null) } })
    const params = targetId === null ? `page=${page}&search=${encodeURIComponent(query)}` : `account=${encodeURIComponent(targetId)}`
    void accountFetch(`/api/admin/users?${params}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setResult(data)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [page, query, targetId])
  async function changeRole(id: string, role: UserRole) {
    setBusy(id); setError('')
    try {
      const response = await accountFetch(`/api/admin/users/${id}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setResult(current => current && { ...current, users: current.users.map(user => user.id === data.id ? { ...user, role: data.role } : user) })
      window.dispatchEvent(new Event('focus'))
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  async function approveAccount(id: string) {
    setBusy(id); setError('')
    try {
      const response = await accountFetch(`/api/admin/users/${id}/approval`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setResult(current => current && { ...current, users: current.users.map(user => user.id === data.id ? { ...user, approved: data.approved, role: data.role ?? user.role, instructor_application_pending: data.instructor_application_pending ?? user.instructor_application_pending } : user) })
      window.dispatchEvent(new Event('focus'))
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  function openGrant(user: Account) {
    setGrantTarget(user); setGrantAmount(''); setGrantError('')
  }
  async function grantPoints(user: Account) {
    const points = Number(grantAmount)
    if (!Number.isInteger(points) || points < 1 || points > 1000000) return setGrantError('Enter a whole number from 1 to 1,000,000.')
    setGranting(true); setGrantError('')
    try {
      const response = await accountFetch(`/api/admin/users/${user.id}/points`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setGrantTarget(null)
      toast(`Gave ${points.toLocaleString()} ${points === 1 ? 'point' : 'points'} to ${user.display_name || user.email}.`)
    } catch (reason) { setGrantError((reason as Error).message) }
    finally { setGranting(false) }
  }
  async function deleteAccount(user: Account) {
    setDeleting(true); setDeleteError('')
    try {
      const response = await accountFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setDeleteTarget(null)
      setResult(current => current && { ...current, users: current.users.filter(item => item.id !== user.id), total: current.total - 1 })
      toast(`Deleted ${user.display_name || user.email}.`)
    } catch (reason) { setDeleteError((reason as Error).message) }
    finally { setDeleting(false) }
  }
  if (!result && !error) return <LoadingScreen label="Loading accounts" />
  return <section className="admin-page" aria-labelledby="accounts-title"><div className="admin-shell">
    <h1 id="accounts-title">Manage accounts</h1>
    {targetId !== null ? <div className="admin-search">
      <button type="button" onClick={() => onNavigate('/inbox')}>Back to inbox</button>
    </div> : <form className="admin-search" onSubmit={event => { event.preventDefault(); if (busy) return; setPage(1); setQuery(search.trim()) }}>
      <CollectionSearch label="Search accounts" placeholder="Name or email" maxLength={200} value={search} onChange={setSearch}>
        <button type="submit" disabled={Boolean(busy)}>Search</button>
      </CollectionSearch>
    </form>}
    {error && <p className="account-error admin-error" role="alert">{error}</p>}
    {(result || !error) && <div className="admin-directory" aria-busy={!result}>
      <div className="admin-list-heading" aria-hidden="true"><span>Account</span><span>Access / Role</span></div>
      {result && <>
        <ul className="admin-users">{result.users.map(user => <li key={user.id} aria-busy={busy === user.id}>
          <div className="admin-user-identity"><strong>{user.display_name || user.email.split('@')[0]}</strong><span>{user.email}</span><span className="admin-approval-status">{user.instructor_application_pending ? 'Professor application pending' : user.approved ? 'Approved' : 'Pending approval'}</span></div>
          <div className="admin-user-actions">
          <label className="admin-role-control">
            <span className="sr-only">Role for {user.email}</span>
            <select value={user.role} disabled={Boolean(busy)} onChange={event => void changeRole(user.id, event.target.value as UserRole)}><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select>
            {busy === user.id ? <span className="admin-role-loading"><LoadingAnimation label="Saving account" compact /></span> : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>}
          </label>
          <ActionMenu label={`Actions for ${user.email}`} disabled={Boolean(busy)} items={[
            ...(!user.approved || user.instructor_application_pending ? [{ label: user.instructor_application_pending ? 'Approve application' : 'Approve account', onSelect: () => void approveAccount(user.id) }] : []),
            { label: 'Give points', onSelect: () => openGrant(user) },
            { label: 'Download signed consent', onSelect: () => {
              setBusy(user.id); setError('')
              void downloadSignedConsent(user.id).catch(reason => setError(reason.message)).finally(() => setBusy(''))
            } },
            { label: 'Delete account', danger: true, onSelect: () => { setDeleteTarget(user); setDeleteError('') } },
          ]} />
          </div>
        </li>)}</ul>
        {!result.users.length && <p className="admin-empty" role="status">No accounts found.</p>}
        {targetId === null && <div className="admin-pagination">
          <span>Page {page} · {result.total} {result.total === 1 ? 'account' : 'accounts'}</span>
          <div className="admin-pagination-actions">
            <button type="button" disabled={page === 1 || Boolean(busy)} onClick={() => setPage(value => value - 1)}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 4-4 4 4 4" /></svg>Previous</button>
            <button type="button" disabled={page * result.pageSize >= result.total || Boolean(busy)} onClick={() => setPage(value => value + 1)}>Next<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg></button>
          </div>
        </div>}
      </>}
    </div>}
    <span className="sr-only" role="status">{busy ? 'Saving account…' : ''}</span>
    {grantTarget && <ConfirmDialog title={`Give points to ${grantTarget.display_name || grantTarget.email}`} confirmLabel={granting ? 'Giving…' : 'Hold to give points'} busy={granting} error={grantError} onConfirm={() => void grantPoints(grantTarget)} onCancel={() => setGrantTarget(null)}>
      <label className="admin-grant-field">Points<input type="number" inputMode="numeric" min={1} max={1000000} step={1} value={grantAmount} disabled={granting} onChange={event => setGrantAmount(event.target.value)} /></label>
    </ConfirmDialog>}
    {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.display_name || deleteTarget.email}?`} confirmLabel={deleting ? 'Deleting…' : 'Hold to delete account'} busy={deleting} error={deleteError} onConfirm={() => void deleteAccount(deleteTarget)} onCancel={() => setDeleteTarget(null)}>
      This permanently deletes their login, chats, survey responses, scores, and points. Their signed consent record is kept.
    </ConfirmDialog>}
  </div></section>
}
