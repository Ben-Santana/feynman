import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'

const HOLD_MS = 1200
const DRAIN_MS = 320
const holdKeys = [' ', 'Enter']

/** Writes the press into --hold-progress on the element and runs onConfirm at 1; releasing early drains it back down. */
export function useHold<T extends HTMLElement>({ disabled, onConfirm }: { disabled?: boolean; onConfirm: () => void }) {
  const element = useRef<T>(null)
  const frame = useRef(0)
  const progress = useRef(0)
  const holding = useRef(false)
  const confirmed = useRef(false)

  function animate() {
    cancelAnimationFrame(frame.current)
    let previous = performance.now()
    const step = (now: number) => {
      const elapsed = now - previous
      previous = now
      progress.current = Math.max(0, Math.min(1, progress.current + (holding.current ? elapsed / HOLD_MS : -elapsed / DRAIN_MS)))
      element.current?.style.setProperty('--hold-progress', String(progress.current))
      if (holding.current && progress.current === 1) {
        if (!confirmed.current) { confirmed.current = true; onConfirm() }
      } else if (holding.current || progress.current > 0) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }
  function press() {
    if (disabled || holding.current) return
    holding.current = true
    confirmed.current = false
    animate()
  }
  function release() {
    if (!holding.current) return
    holding.current = false
    animate()
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  useEffect(() => {
    if (!disabled || !holding.current) return
    holding.current = false
    animate()
    // animate only reads refs, so the closure from an earlier render is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  return {
    ref: element,
    handlers: {
      onPointerDown: (event: PointerEvent<T>) => { if (event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); press() } },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onBlur: release,
      onContextMenu: (event: MouseEvent<T>) => event.preventDefault(),
      onKeyDown: (event: KeyboardEvent<T>) => { if (holdKeys.includes(event.key)) { event.preventDefault(); if (!event.repeat) press() } },
      onKeyUp: (event: KeyboardEvent<T>) => { if (holdKeys.includes(event.key)) { event.preventDefault(); release() } },
      // Assistive tech activates with a synthetic click and can't hold.
      onClick: (event: MouseEvent<T>) => { if (event.detail === 0) onConfirm() },
    },
  }
}
