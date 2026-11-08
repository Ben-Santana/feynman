import { useEffect, useRef } from 'react'
import type { Account } from './accounts'
import { logActivity } from './research'

const minute = 60_000
const idleAfter = 2 * minute

// Records student engagement for research: app opens, topic and report views,
// and one 'active' event per minute of visible, recently used app time.
export function useActivityTracking(account: Account, page: string, sessionId: string) {
  const student = account.role === 'student'
  const current = useRef({ page, sessionId })
  useEffect(() => { current.current = { page, sessionId } }, [page, sessionId])
  useEffect(() => { if (student) logActivity('app_open') }, [student])
  useEffect(() => {
    if (!student || !sessionId) return
    if (page === '/chat') logActivity('topic_open', sessionId)
    else if (page === '/summary') logActivity('report_view', sessionId)
  }, [student, page, sessionId])
  useEffect(() => {
    if (!student) return
    let lastInput = Date.now()
    const touched = () => { lastInput = Date.now() }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach(name => window.addEventListener(name, touched, { passive: true }))
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput > idleAfter) return
      const { page: path, sessionId: id } = current.current
      logActivity('active', ['/chat', '/summary'].includes(path) ? id : null)
    }, minute)
    return () => { window.clearInterval(timer); events.forEach(name => window.removeEventListener(name, touched)) }
  }, [student])
}
