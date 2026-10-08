import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { equationText, messageLimit, replaceDraft, splitMathDraft } from '../mathDraft'
import { ChatText } from './ChatText'
import './ChatComposer.css'

const EquationEditor = lazy(() => import('./EquationEditor'))
type Editing = { start: number; end: number; latex: string; display: boolean }

export function ChatComposer({ value, onChange, onSend, busy, className }: {
  value: string; onChange: (value: string) => void; onSend: () => void; busy: boolean; className: string
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [error, setError] = useState('')
  const cursor = useRef({ start: value.length, end: value.length })
  const root = useRef<HTMLFormElement>(null)
  const parts = splitMathDraft(value)
  const cancel = useCallback(() => { setEditing(null); setError('') }, [])
  function update(start: number, end: number, text: string) {
    try { onChange(replaceDraft(value, start, end, text)); setError('') }
    catch (reason) { setError((reason as Error).message) }
  }
  function apply(latex: string, display: boolean) {
    if (!editing) return
    try {
      const equation = equationText(latex, display)
      onChange(replaceDraft(value, editing.start, editing.end, equation))
      const position = editing.start + equation.length
      cursor.current = { start: position, end: position }
      setEditing(null); setError('')
      requestAnimationFrame(() => {
        const textarea = root.current?.querySelector<HTMLTextAreaElement>(`textarea[data-start="${position}"]`)
        textarea?.focus(); textarea?.setSelectionRange(0, 0)
      })
    } catch (reason) { setError((reason as Error).message) }
  }
  return <form ref={root} className={`${className} math-composer`} onSubmit={event => { event.preventDefault(); if (!busy && !editing && value.trim()) onSend() }}>
    <div className="math-composer-body">
      <div className="mixed-draft">
        {parts.map((part, index) => part.latex !== undefined
          ? <span key={index} className={`draft-equation ${part.display ? 'draft-equation-display' : ''}`}>
            <button type="button" className="draft-equation-edit" disabled={busy || Boolean(editing)} aria-label={`Edit equation ${Math.ceil(index / 2)}`} onClick={() => { setError(''); setEditing({ start: part.start, end: part.end, latex: part.latex!, display: Boolean(part.display) }) }}><ChatText>{part.text}</ChatText></button>
            <button type="button" className="draft-equation-remove" disabled={busy || Boolean(editing)} aria-label={`Remove equation ${Math.ceil(index / 2)}`} onClick={() => { update(part.start, part.end, ''); cursor.current = { start: part.start, end: part.start } }}>×</button>
          </span>
          : <textarea key={index} data-start={part.start} aria-label={index === 0 ? 'Your explanation' : `Text after equation ${index / 2}`} value={part.text} placeholder={index === 0 ? 'Explain your reasoning…' : 'Continue your explanation…'} rows={1} maxLength={messageLimit - value.length + part.text.length} disabled={busy || Boolean(editing)}
            onChange={event => update(part.start, part.end, event.target.value)}
            onSelect={event => { const input = event.currentTarget; cursor.current = { start: part.start + input.selectionStart, end: part.start + input.selectionEnd } }}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (value.trim()) onSend() } }} />)}
      </div>
      {!editing && <button type="button" className="insert-equation" disabled={busy} onClick={() => { setError(''); const start = Math.min(cursor.current.start, value.length); const end = Math.min(cursor.current.end, value.length); setEditing({ start, end, latex: value.slice(start, end), display: false }) }}><span aria-hidden="true">ƒx</span> Insert equation</button>}
      {editing && <Suspense fallback={<p role="status">Loading equation editor…</p>}><EquationEditor initial={editing.latex} display={editing.display} onApply={apply} onCancel={cancel} /></Suspense>}
      {error && <p className="chat-error" role="alert">{error}</p>}
    </div>
    <button type="submit" className="send-button" disabled={busy || Boolean(editing) || !value.trim()}>{busy ? 'Thinking…' : 'Send'}</button>
  </form>
}
