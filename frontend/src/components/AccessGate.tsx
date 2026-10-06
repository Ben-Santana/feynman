import { useEffect, useRef, useState, type ReactNode } from 'react'
import './AccessGate.css'

type Status = 'checking' | 'ready' | 'submitting' | 'success' | 'error' | 'unlocked'
export default function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [digits, setDigits] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/access', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(response => response.json()).then(result => setStatus(result.unlocked ? 'unlocked' : 'ready')).catch(() => { if (!controller.signal.aborted) setStatus('ready') })
    return () => { controller.abort(); if (timer.current) clearTimeout(timer.current) }
  }, [])
  useEffect(() => { if (status === 'ready') input.current?.focus() }, [status])
  async function update(value: string) {
    if (status !== 'ready') return
    const code = value.replace(/\D/g, '').slice(0, 4)
    setDigits(code)
    if (code.length !== 4) return
    setStatus('submitting')
    let passed = false
    try {
      const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(10000) })
      passed = response.ok && (await response.json()).unlocked === true
    } catch { /* A failed request leaves the gate closed. */ }
    setStatus(passed ? 'success' : 'error')
    timer.current = setTimeout(() => {
      if (passed) setStatus('unlocked')
      else { setDigits(''); setStatus('ready') }
    }, passed ? 650 : 550)
  }
  if (status === 'unlocked') return children
  return <main className="access-gate">
    <div className={`access-code access-code--${status}`} onClick={() => input.current?.focus()}>
      <div className="access-boxes" aria-hidden="true">
        {[0, 1, 2, 3].map(index => <span key={index} className={`access-digit ${status === 'ready' && index === Math.min(digits.length, 3) ? 'access-digit--active' : ''}`}>{digits[index] || ''}</span>)}
      </div>
      <input ref={input} className="access-input" aria-label="Four-digit access code" type="text" inputMode="numeric" pattern="[0-9]{4}" autoComplete="one-time-code" maxLength={4} value={digits} readOnly={status !== 'ready'} aria-invalid={status === 'error'} onChange={event => void update(event.target.value)} />
    </div>
  </main>
}
