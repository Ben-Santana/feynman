import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TooltipAnchor } from './useButtonTooltip'

/** A black tooltip that smoothly follows viewport coordinates while mounted. */
export function CursorTooltip({ id, text, anchor }: {
  id: string; text: string; anchor: TooltipAnchor
}) {
  const element = useRef<HTMLSpanElement>(null)
  const position = useRef<TooltipAnchor | null>(null)

  useLayoutEffect(() => {
    const tooltip = element.current
    if (!tooltip) return
    const bounds = tooltip.getBoundingClientRect()
    const halfWidth = bounds.width / 2
    const target = {
      left: Math.max(halfWidth + 8, Math.min(anchor.left, window.innerWidth - halfWidth - 8)),
      top: Math.max(bounds.height + 8, Math.min(anchor.top, window.innerHeight - 8)),
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!position.current || reducedMotion.matches) position.current = { ...target }
    let frame = 0
    let previousTime = performance.now()
    function move(now: number) {
      const current = position.current!
      // Time-based easing keeps the same feel across display refresh rates.
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-(now - previousTime) / 65)
      previousTime = now
      current.left += (target.left - current.left) * blend
      current.top += (target.top - current.top) * blend
      const settled = Math.abs(target.left - current.left) + Math.abs(target.top - current.top) < .1
      if (settled) Object.assign(current, target)
      tooltip!.style.left = `${current.left}px`
      tooltip!.style.top = `${current.top}px`
      if (!settled) frame = requestAnimationFrame(move)
    }
    move(previousTime)
    return () => cancelAnimationFrame(frame)
  }, [anchor.left, anchor.top, text])

  return createPortal(<span ref={element} id={id} className="board-tooltip floating-button-tooltip" role="tooltip">{text}</span>, document.body)
}
