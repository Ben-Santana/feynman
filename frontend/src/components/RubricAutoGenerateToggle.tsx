import { useEffect, useRef, useState } from 'react'

type RubricAutoGenerateToggleProps = {
  checked: boolean
  regenerate: boolean
  onChange: (checked: boolean) => void
  instructions: string
  onInstructionsChange: (instructions: string) => void
}

export function RubricAutoGenerateToggle({ checked, regenerate, onChange, instructions, onInstructionsChange }: RubricAutoGenerateToggleProps) {
  const [open, setOpen] = useState(false)
  return <div className="rubric-ai-controls">
    <label className="rubric-auto-toggle">
      <input className="rubric-auto-toggle-input" type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span className="rubric-auto-toggle-box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.8 12.3 9.1 17.2 20 5.8" /></svg>
      </span>
      <span>{regenerate ? 'Re-generate rubric' : 'Auto-generate rubric'}</span>
    </label>
    <button type="button" className="setup-secondary rubric-instructions-button" aria-label="Additional instructions" title="Additional instructions" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--background)" /><circle cx="15" cy="17" r="3" fill="var(--background)" /></svg>
    </button>
    {open && <InstructionsDialog value={instructions} onSave={value => { onInstructionsChange(value); setOpen(false) }} onClose={() => setOpen(false)} />}
  </div>
}

function InstructionsDialog({ value, onSave, onClose }: { value: string; onSave: (value: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className="rubric-instructions-dialog" aria-labelledby="rubric-instructions-title" aria-describedby="rubric-instructions-description" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 id="rubric-instructions-title">Additional instructions</h2>
    <p id="rubric-instructions-description">Tell the AI what to focus on when generating your rubric.</p>
    <label htmlFor="rubric-instructions">Instructions for the AI</label>
    <textarea id="rubric-instructions" autoFocus rows={7} maxLength={5000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="For example, focus on practical examples and include key vocabulary." />
    <div className="learning-type-change-actions">
      <button type="button" className="setup-secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="send-button" onClick={() => onSave(draft)}>Save instructions</button>
    </div>
  </dialog>
}
