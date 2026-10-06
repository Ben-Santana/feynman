export function AISettingsButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="ai-settings-link" onClick={onClick} aria-label="AI settings" title="AI settings">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9.5 3-.5 2a7.3 7.3 0 0 0-1.6.9l-2-.6-2.5 4.3 1.5 1.4a7.3 7.3 0 0 0 0 1.8l-1.5 1.4 2.5 4.3 2-.6a7.3 7.3 0 0 0 1.6.9l.5 2h5l.5-2a7.3 7.3 0 0 0 1.6-.9l2 .6 2.5-4.3-1.5-1.4a7.3 7.3 0 0 0 0-1.8l1.5-1.4-2.5-4.3-2 .6A7.3 7.3 0 0 0 15 5l-.5-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  </button>
}
