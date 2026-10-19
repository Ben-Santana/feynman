import { useEffect, useState } from 'react'
import { Bloub } from './Bloub'
import './AccountLoading.css'

export function LoadingAnimation({ label = 'Loading', compact = false, delayMs = 600 }: { label?: string; compact?: boolean; delayMs?: number }) {
  const [ready, setReady] = useState(delayMs === 0)
  useEffect(() => {
    if (delayMs === 0) return
    const timer = window.setTimeout(() => setReady(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  return <span className={`account-loading${compact ? ' account-loading-compact' : ''}`} role="status" aria-label={label} aria-busy="true">
    {(ready || delayMs === 0) && <span className="account-loading-stage" aria-hidden="true">
      <span className="account-loading-avatar">
        <Bloub mode="loading" expression="attentive" showControls={false} />
      </span>
    </span>}
  </span>
}

export function LoadingScreen({ label = 'Loading', delayMs }: { label?: string; delayMs?: number }) {
  return <div className="loading-screen"><LoadingAnimation label={label} delayMs={delayMs} /></div>
}

export function AccountLoading() {
  return <main className="account-login"><LoadingAnimation label="Checking your login" /></main>
}
