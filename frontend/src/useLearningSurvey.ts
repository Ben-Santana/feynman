import { useCallback, useEffect, useRef, useState } from 'react'
import { accountSignal, type Account } from './accounts'
import { loadSurveyStatus, type SurveyStatus } from './learningSurvey'
import { flushSessionSaves, getSaveStatus } from './learningStore'

export function useLearningSurvey(account: Account, refreshKey: string) {
  const [status, setStatus] = useState<SurveyStatus>(null)
  const [ready, setReady] = useState(account.role !== 'student')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const prompted = useRef('')
  const requestVersion = useRef(0)
  const refresh = useCallback(async () => {
    if (account.role !== 'student') return null
    const version = ++requestVersion.current
    const next = await loadSurveyStatus()
    if (version !== requestVersion.current) return next
    setStatus(next); setReady(true); setError('')
    if (next && !next.submittedAt && prompted.current !== next.sessionId) {
      prompted.current = next.sessionId; setOpen(true)
    }
    return next
  }, [account.role])
  useEffect(() => {
    let disposed = false
    const check = () => { void refresh().catch(reason => { if (!disposed && !accountSignal().aborted) setError(reason.message) }) }
    check()
    window.addEventListener('focus', check)
    return () => { disposed = true; window.removeEventListener('focus', check) }
  }, [refresh, refreshKey])
  const guard = useCallback(async () => {
    if (account.role !== 'student') return true
    try {
      await flushSessionSaves()
      if (getSaveStatus().state === 'conflict') throw new Error('Resolve the save conflict before opening another topic.')
      const next = await refresh()
      if (next && !next.submittedAt) { setOpen(true); return false }
      return true
    } catch (reason) { setError((reason as Error).message); return false }
  }, [account.role, refresh])
  return { status, ready, error, open, guard, refresh, show: () => setOpen(true), close: () => setOpen(false), submitted: () => { requestVersion.current++; setStatus(current => current && { ...current, submittedAt: new Date().toISOString() }); setOpen(false) } }
}
