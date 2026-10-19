import { useEffect, useState } from 'react'
import { accountFetch, type Account, type UserRole } from '../accounts'
import { LoadingAnimation, LoadingScreen } from './AccountLoading'
import './AdminPage.css'
import { downloadSignedConsent } from '../accounts'

type UserPage = { users: Account[]; total: number; page: number; pageSize: number }
export function AdminPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<UserPage | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) { setError(''); setResult(null) } })
    void accountFetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(query)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setResult(data)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [page, query])
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
      setResult(current => current && { ...current, users: current.users.map(user => user.id === data.id ? { ...user, approved: data.approved } : user) })
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  if (!result && !error) return <LoadingScreen label="Loading accounts" />
  return <section className="admin-page" aria-labelledby="accounts-title"><div className="admin-shell">
    <h1 id="accounts-title">Manage accounts</h1>
    <form className="admin-search" onSubmit={event => { event.preventDefault(); if (busy) return; setPage(1); setQuery(search.trim()) }}>
      <div className="admin-search-field">
        <label className="sr-only" htmlFor="account-search">Search accounts</label>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input id="account-search" type="search" value={search} placeholder="Name or email" maxLength={200} onChange={event => setSearch(event.target.value)} />
      </div>
      <button type="submit" disabled={Boolean(busy)}>Search</button>
    </form>
    {error && <p className="account-error admin-error" role="alert">{error}</p>}
    {(result || !error) && <div className="admin-directory" aria-busy={!result}>
      <div className="admin-list-heading" aria-hidden="true"><span>Account</span><span>Access / Role</span></div>
      {result && <>
        <ul className="admin-users">{result.users.map(user => <li key={user.id} aria-busy={busy === user.id}>
          <div className="admin-user-identity"><strong>{user.display_name || user.email.split('@')[0]}</strong><span>{user.email}</span><span className="admin-approval-status">{user.approved ? 'Approved' : 'Pending approval'}</span></div>
          <div className="admin-user-actions">
          <button type="button" className="admin-approve" disabled={Boolean(busy)} aria-label={`Download consent for ${user.email}`} onClick={() => {
            setBusy(user.id); setError('')
            void downloadSignedConsent(user.id).catch(reason => setError(reason.message)).finally(() => setBusy(''))
          }}>Signed consent</button>
          {!user.approved && <button type="button" className="admin-approve" disabled={Boolean(busy)} aria-label={`Approve ${user.email}`} onClick={() => void approveAccount(user.id)}>Approve account</button>}
          <label className="admin-role-control">
            <span className="sr-only">Role for {user.email}</span>
            <select value={user.role} disabled={Boolean(busy)} onChange={event => void changeRole(user.id, event.target.value as UserRole)}><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select>
            {busy === user.id ? <span className="admin-role-loading"><LoadingAnimation label="Saving account" compact /></span> : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>}
          </label>
          </div>
        </li>)}</ul>
        {!result.users.length && <p className="admin-empty" role="status">No accounts found.</p>}
        <div className="admin-pagination">
          <span>Page {page} · {result.total} {result.total === 1 ? 'account' : 'accounts'}</span>
          <div className="admin-pagination-actions">
            <button type="button" disabled={page === 1 || Boolean(busy)} onClick={() => setPage(value => value - 1)}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 4-4 4 4 4" /></svg>Previous</button>
            <button type="button" disabled={page * result.pageSize >= result.total || Boolean(busy)} onClick={() => setPage(value => value + 1)}>Next<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg></button>
          </div>
        </div>
      </>}
    </div>}
    <span className="sr-only" role="status">{busy ? 'Saving account…' : ''}</span>
  </div></section>
}
