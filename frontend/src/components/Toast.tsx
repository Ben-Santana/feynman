import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext } from './useToast'
import './Toast.css'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const [paused, setPaused] = useState(false)
  const nextId = useRef(0)
  const showToast = useCallback((message: string) => {
    setPaused(false)
    setToast({ id: ++nextId.current, message })
  }, [])
  useEffect(() => {
    if (!toast || paused) return
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  return <ToastContext.Provider value={showToast}>
    {children}
    {createPortal(<div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {toast && <div key={toast.id} className="toast" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
        <span className="toast-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12 4 4 8-8" /></svg></span>
        <span className="toast-message">{toast.message}</span>
        <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => setToast(null)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
      </div>}
    </div>, document.body)}
  </ToastContext.Provider>
}

