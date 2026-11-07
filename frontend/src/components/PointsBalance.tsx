import { useEffect, useRef, useState } from 'react'
import type { Wallet } from '../points'

function useCountdown(value: number) {
  const [shown, setShown] = useState(value)
  const current = useRef(value)
  useEffect(() => {
    const from = current.current
    if (value >= from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 800)
      current.current = Math.round(from + (value - from) * (1 - (1 - progress) ** 3))
      setShown(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return shown
}

export function PointsBalance({ wallet, className }: { wallet: Wallet; className: string }) {
  const shown = useCountdown(wallet.points ?? 0)
  const unlimited = wallet.points === null
  return <div className={`points-balance ${className}`} role="img" title="Points" aria-label={unlimited ? 'Unlimited points' : `${wallet.points} points`}>
    <span className="points-dot" />{unlimited ? '∞' : shown}
  </div>
}
