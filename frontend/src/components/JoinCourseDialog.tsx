import { useEffect, useRef, useState } from 'react'
import { accountSignal } from '../accounts'
import { joinCourse, type Enrollment } from '../courseStore'

export function JoinCourseDialog({ onClose, onJoined }: { onClose: () => void; onJoined: (enrollment: Enrollment) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const lock = useRef(false)
  const [characters, setCharacters] = useState<string[]>(() => Array(6).fill(''))
  const code = characters.join('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); inputs.current[0]?.focus(); return () => element?.close() }, [])

  function enterCharacters(index: number, value: string) {
    const incoming = value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6)
    if (!incoming) return
    const start = incoming.length === 6 ? 0 : index
    setCharacters(previous => {
      const next = [...previous]
      for (let offset = 0; offset < incoming.length && start + offset < 6; offset++) next[start + offset] = incoming[offset]
      return next
    })
    setError('')
    const nextInput = inputs.current[Math.min(start + incoming.length, 5)]
    nextInput?.focus(); nextInput?.select()
  }

  function clearCharacter(index: number) {
    setCharacters(previous => previous.map((character, position) => position === index ? '' : character))
    setError('')
  }

  async function submit() {
    if (lock.current || !characters.every(character => /^[A-Z2-9]$/.test(character))) return
    lock.current = true; setJoining(true); setError('')
    const signal = accountSignal()
    try {
      const enrollment = await joinCourse(code)
      signal.throwIfAborted()
      onJoined(enrollment)
    } catch (reason) {
      if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not join the course. Please retry.')
    } finally { lock.current = false; if (!signal.aborted) setJoining(false) }
  }

  return <dialog ref={dialog} className="course-edit-dialog course-join-dialog" aria-labelledby="course-join-title" onCancel={event => { event.preventDefault(); if (!joining) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={joining}>
      <div className="course-edit-heading"><h2 id="course-join-title">Join course</h2><button type="button" className="course-dialog-close" aria-label="Close join course" disabled={joining} onClick={onClose}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <div className="course-code-field" role="group" aria-labelledby="course-code-label">
        <span id="course-code-label">Course code</span>
        <div className="course-code-inputs">{characters.map((character, index) => <input key={index} ref={element => { inputs.current[index] = element }}
          aria-label={`Character ${index + 1} of 6`} required maxLength={6} pattern="[A-Z2-9]" value={character}
          onChange={event => { if (event.target.value) enterCharacters(index, event.target.value); else clearCharacter(index) }}
          onPaste={event => { event.preventDefault(); enterCharacters(index, event.clipboardData.getData('text')) }}
          onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
          onKeyDown={event => {
            if (event.altKey || event.ctrlKey || event.metaKey) return
            if (event.key === 'Backspace') {
              event.preventDefault()
              const target = character || index === 0 ? index : index - 1
              clearCharacter(target); inputs.current[target]?.focus()
            } else if (event.key === 'Delete') {
              event.preventDefault(); clearCharacter(index)
            } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault()
              const target = event.key === 'Home' ? 0 : event.key === 'End' ? 5 : Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)))
              inputs.current[target]?.focus()
            }
          }}
          autoCapitalize="characters" autoComplete={index === 0 ? 'one-time-code' : 'off'} spellCheck={false} autoFocus={index === 0} disabled={joining}
        />)}</div>
      </div>
      {error && <p className="course-edit-error" role="alert">{error}</p>}
      <div className="course-edit-footer"><button type="button" disabled={joining} onClick={onClose}>Cancel</button><button type="submit" className="course-primary-action" disabled={joining || code.length !== 6}>{joining ? 'Joining…' : 'Join course'}</button></div>
    </form>
  </dialog>
}
