import './LibraryEmptyState.css'

export function LibraryEmptyState({ kind, title, description, action }: {
  kind: 'courses' | 'starred' | 'sessions'
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return <div className="library-empty-state" role="status">
    <div className="library-empty-panel">
    <svg className="library-empty-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'starred' ? <path d="m16 4 3.7 7.5 8.3 1.2-6 5.8 1.4 8.3-7.4-3.9-7.4 3.9 1.4-8.3-6-5.8 8.3-1.2L16 4Z" /> : kind === 'sessions' ? <path d="M27 15a11 11 0 0 1-11 11c-1.7 0-3.3-.4-4.8-1L5 27l2-6.2A11 11 0 1 1 27 15Z" /> : <><path d="M16 8c-3.5-2.5-8-3-12-2v20c4-1 8.5-.5 12 2 3.5-2.5 8-3 12-2V6c-4-1-8.5-.5-12 2Z" /><path d="M16 8v20" /></>}
    </svg>
    <div className="library-empty-copy">
    <h2 className="library-empty-title">{title}</h2>
    {description && <p className="library-empty-description">{description}</p>}
    </div>
    {action && <button type="button" className="library-empty-action" onClick={action.onClick}>{action.label}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg></button>}
    </div>
  </div>
}
