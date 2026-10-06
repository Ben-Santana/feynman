export function BackButton({ onClick, destination }: { onClick: () => void; destination: string }) {
  return <button type="button" className="back-button" onClick={onClick} aria-label={`Back to ${destination}`}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
  </button>
}
