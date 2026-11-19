import { useState } from 'react'
import { accountSignal } from '../accounts'
import { respondCourseInvitation } from '../courseStore'
import type { InboxMessage, useInbox } from '../useInbox'
import { useToast } from './useToast'
import './AdminPage.css'
import './InboxPage.css'

export function InboxPage({ inbox, onNavigate }: {
  inbox: ReturnType<typeof useInbox>
  onNavigate: (path: string) => void
}) {
  const { result, error, page, changePage } = inbox
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const toast = useToast()
  const pagedTotal = result ? result.pagedTotal ?? result.total : 0
  async function respond(message: InboxMessage & { invitation: object }, accept: boolean) {
    if (busy) return
    const signal = accountSignal()
    setBusy(message.id); setActionError('')
    try {
      await respondCourseInvitation(message.invitation.courseId, accept)
      signal.throwIfAborted()
      // The inbox and course lists reload on focus.
      window.dispatchEvent(new Event('focus'))
      toast(accept ? `You now teach ${message.invitation.courseName}.` : 'Invitation declined.')
      if (accept) onNavigate(`/courses/${message.invitation.courseId}`)
    } catch (reason) {
      if (!signal.aborted) setActionError(reason instanceof Error ? reason.message : 'Could not save changes. Please retry.')
    } finally { if (!signal.aborted) setBusy('') }
  }
  return <main className="admin-page inbox-page" aria-labelledby="inbox-title">
    <div className="admin-shell">
      <h1 id="inbox-title">Inbox</h1>
      {(error || actionError) && <p role="alert" className="account-error admin-error">{actionError || error}</p>}
      <div className="admin-directory">
        {result?.messages.length ? <>
          <ul className="admin-users inbox-messages">
            {result.messages.map(message => {
              if (message.invitation) return <li key={message.id} className="inbox-invitation" aria-busy={busy === message.id}>
                <span className="inbox-message-copy">
                  <strong>{message.title}</strong>
                  <span>{message.description}</span>
                </span>
                <span className="inbox-invitation-actions">
                  <button type="button" disabled={Boolean(busy)} onClick={() => void respond(message, false)}>Decline</button>
                  <button type="button" className="inbox-accept" disabled={Boolean(busy)} onClick={() => void respond(message, true)}>Accept</button>
                </span>
              </li>
              const { href, label } = message.action
              return <li key={message.id}>
                <a href={href} onClick={event => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  onNavigate(href)
                }}>
                  <span className="inbox-message-copy">
                    <strong>{message.title}</strong>
                    <span>{message.description}</span>
                  </span>
                  <span className="inbox-message-action">{label} <span aria-hidden="true">→</span></span>
                </a>
              </li>
            })}
          </ul>
          {pagedTotal > result.pageSize && <div className="admin-pagination">
            <span>Page {page} · {result.total} messages</span>
            <div className="admin-pagination-actions">
              <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
              <button type="button" disabled={page * result.pageSize >= pagedTotal} onClick={() => changePage(page + 1)}>Next</button>
            </div>
          </div>}
        </> : <p className="admin-empty" role="status">{result ? 'No messages.' : error ? 'Inbox unavailable.' : 'Loading inbox…'}</p>}
      </div>
    </div>
  </main>
}
