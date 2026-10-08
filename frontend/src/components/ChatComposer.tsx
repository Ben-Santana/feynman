import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { MathfieldElement } from 'mathlive'
import { draftEquationLine, equationDraftIssue, messageLimit, replaceDraft, splitComposerDraft } from '../mathDraft'
import { draftDomText, draftSelection, equationRange, focusDraft } from './mathComposerDom'
import EquationTools from './EquationEditor'
import { createEquationField } from './inlineEquation'
import './ChatComposer.css'

export function ChatComposer({ value, onChange, onSend, busy, className }: {
  value: string; onChange: (value: string) => void; onSend: () => void; busy: boolean; className: string
}) {
  const [activeField, setActiveField] = useState<MathfieldElement | null>(null)
  const [error, setError] = useState('')
  const cursor = useRef({ start: value.length, end: value.length })
  const editor = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const pendingEquation = useRef<number | null>(null)
  const callbacks = useRef({ onChange, busy })
  useLayoutEffect(() => { callbacks.current = { onChange, busy } }, [onChange, busy])
  const issue = equationDraftIssue(value)
  const hasEmptyEquation = splitComposerDraft(value).some(part => part.latex !== undefined && !part.latex.trim())
  const canSend = !busy && Boolean(value.trim()) && value.length <= messageLimit && !issue
  const showSend = busy || splitComposerDraft(value).some(part => (part.latex ?? part.text).trim())

  const focusText = useCallback((position: number) => {
    requestAnimationFrame(() => {
      if (editor.current) focusDraft(editor.current, position)
      cursor.current = { start: position, end: position }
      setActiveField(null)
    })
  }, [])
  const commitInput = useCallback(() => {
    const host = editor.current
    if (!host || composing.current) return
    const next = draftDomText(host)
    if (!next) host.replaceChildren()
    callbacks.current.onChange(next)
    setError(next.length > messageLimit ? 'Your message is too long. Shorten it before adding more.' : '')
  }, [])
  const leaveEquation = useCallback((line: HTMLElement, direction: 'before' | 'after') => {
    if (!editor.current) return
    const range = equationRange(editor.current, line)
    focusText(direction === 'before' ? range.start : range.end)
  }, [focusText])
  const removeEmptyEquation = useCallback((line: HTMLElement) => {
    if (!editor.current) return
    const range = equationRange(editor.current, line)
    line.remove(); setActiveField(null); commitInput(); focusText(range.start)
  }, [commitInput, focusText])

  // Keep each live math field mounted while it is being typed in. Its source
  // updates immediately; text, equations, saved drafts and sends share one value.
  useLayoutEffect(() => {
    const host = editor.current
    if (!host || draftDomText(host) === value) return
    setActiveField(null)
    host.replaceChildren()
    for (const part of splitComposerDraft(value)) {
      if (part.latex === undefined) { host.append(document.createTextNode(part.text)); continue }
      const line = document.createElement('span')
      line.className = 'inline-equation-line'
      line.contentEditable = 'false'
      line.dataset.equation = part.text
      const math = createEquationField(part.latex)
      math.addEventListener('input', () => {
        const before = line.dataset.equation?.startsWith('\n') ? '\n' : ''
        const after = line.dataset.equation?.endsWith('\n') ? '\n' : ''
        line.dataset.equation = `${before}$$${math.value.trim() || ' '}$$${after}`
        commitInput()
      })
      math.addEventListener('focus', () => setActiveField(math))
      math.addEventListener('blur', () => setActiveField(current => current === math ? null : current))
      math.addEventListener('keydown', event => {
        if (event.isComposing) return
        if (callbacks.current.busy) return
        if (event.key === 'Backspace' && !math.value.trim()) {
          event.preventDefault(); event.stopPropagation(); removeEmptyEquation(line)
        } else if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); leaveEquation(line, 'after')
        }
      }, true)
      math.addEventListener('move-out', event => {
        event.preventDefault()
        leaveEquation(line, ['backward', 'upward'].includes(event.detail.direction) ? 'before' : 'after')
      })
      line.append(math); host.append(line)
      if (pendingEquation.current !== null && part.start <= pendingEquation.current && part.end > pendingEquation.current) {
        pendingEquation.current = null
        requestAnimationFrame(() => { math.position = -1; math.focus(); setActiveField(math) })
      }
    }
    if (value && !host.lastChild?.textContent) {
      const tail = document.createElement('br'); tail.dataset.tail = ''; host.append(tail)
    }
  }, [value, commitInput, leaveEquation, removeEmptyEquation])
  useLayoutEffect(() => {
    editor.current?.querySelectorAll<MathfieldElement>('math-field').forEach(math => { math.disabled = busy })
  }, [busy, value])

  function rememberCursor() {
    if (!editor.current || activeField?.hasFocus()) return
    const selection = draftSelection(editor.current)
    if (selection) cursor.current = selection
  }
  function insertText(text: string) {
    if (!editor.current) return
    const selection = draftSelection(editor.current) ?? cursor.current
    try {
      onChange(replaceDraft(value, selection.start, selection.end, text)); setError('')
      focusText(selection.start + text.length)
    } catch (reason) { setError((reason as Error).message) }
  }
  function addEquation() {
    let { start, end } = cursor.current
    const line = activeField?.closest<HTMLElement>('[data-equation]')
    if (line && editor.current) { start = equationRange(editor.current, line).end; end = start }
    start = Math.min(start, value.length); end = Math.min(end, value.length)
    try {
      const equation = draftEquationLine(value, start, end, '')
      pendingEquation.current = start
      onChange(replaceDraft(value, start, end, equation)); setError('')
    } catch (reason) { pendingEquation.current = null; setError((reason as Error).message) }
  }
  return <form className={`${className} math-composer`} onSubmit={event => { event.preventDefault(); if (canSend) onSend() }}>
    <div className="math-composer-body">
      <div ref={editor} className="mixed-draft" role="textbox" aria-label="Your explanation" aria-multiline="true" aria-disabled={busy} data-placeholder="Explain your reasoning…" contentEditable={!busy} suppressContentEditableWarning
        onInput={event => { if (!(event.target as HTMLElement).closest('math-field')) { rememberCursor(); commitInput() } }}
        onKeyUp={rememberCursor} onMouseUp={rememberCursor} onBlur={rememberCursor}
        onCompositionStart={event => { if (!(event.target as HTMLElement).closest('math-field')) composing.current = true }}
        onCompositionEnd={event => { if (!(event.target as HTMLElement).closest('math-field')) { composing.current = false; commitInput() } }}
        onPaste={event => { if ((event.target as HTMLElement).closest('math-field')) return; event.preventDefault(); if (!busy) insertText(event.clipboardData.getData('text/plain')) }}
        onKeyDown={event => {
          if ((event.target as HTMLElement).closest('math-field') || event.nativeEvent.isComposing || busy) return
          const selection = editor.current && draftSelection(editor.current)
          if (selection && selection.start === selection.end && ['Backspace', 'Delete'].includes(event.key)) {
            const lines = editor.current!.querySelectorAll<HTMLElement>('[data-equation]')
            for (const line of lines) {
              const range = equationRange(editor.current!, line)
              if ((event.key === 'Backspace' && range.end === selection.start) || (event.key === 'Delete' && range.start === selection.start)) {
                event.preventDefault()
                const math = line.querySelector<MathfieldElement>('math-field')!
                if (!math.value.trim()) removeEmptyEquation(line)
                else { math.position = event.key === 'Backspace' ? -1 : 0; math.focus() }
                return
              }
            }
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (event.shiftKey) insertText('\n')
            else if (canSend) onSend()
          }
        }} />
      <div className="composer-tools">
        <button type="button" className="insert-equation" disabled={busy} onMouseDown={event => { rememberCursor(); event.preventDefault() }} onClick={addEquation}><span aria-hidden="true">ƒx</span> Equation</button>
        <div className="equation-tools-slot">
          {activeField && !busy && <EquationTools field={activeField} />}
        </div>
      </div>
      {(error || (issue && !hasEmptyEquation)) && <p className="equation-hint" role="status">{error || issue}</p>}
    </div>
    <div className="composer-send-slot" data-visible={showSend} data-busy={busy} inert={!showSend} aria-hidden={!showSend}>
      <button type="submit" className="send-button" disabled={!canSend}>{busy ? 'Thinking…' : 'Send'}</button>
    </div>
  </form>
}
