import type { useInbox } from '../useInbox'
import './AdminPage.css'
import './InboxPage.css'

export function InboxPage({ inbox, onNavigate }: {
  inbox: ReturnType<typeof useInbox>
  onNavigate: (path: string) => void
}) {
  const { result, error, page, changePage } = inbox
  return <main className="admin-page inbox-page" aria-labelledby="inbox-title">
    <div className="admin-shell">
      <h1 id="inbox-title">Inbox</h1>
      {error && <p role="alert" className="account-error admin-error">{error}</p>}
      <div className="admin-directory">
        {result?.messages.length ? <>
          <ul className="admin-users inbox-messages">
            {result.messages.map(message => {
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
          {result.total > result.pageSize && <div className="admin-pagination">
            <span>Page {page} · {result.total} messages</span>
            <div className="admin-pagination-actions">
              <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
              <button type="button" disabled={page * result.pageSize >= result.total} onClick={() => changePage(page + 1)}>Next</button>
            </div>
          </div>}
        </> : <p className="admin-empty" role="status">{result ? 'No messages.' : error ? 'Inbox unavailable.' : 'Loading inbox…'}</p>}
      </div>
    </div>
  </main>
}
