import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

export function ConceptTooltip({ name, left: anchor, top, bottom }: { name: string; left: number; top: number; bottom: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState({ left: anchor, top, above: false })
  useLayoutEffect(() => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return
    const left = Math.max(bounds.width / 2 + 12, Math.min(anchor, window.innerWidth - bounds.width / 2 - 12))
    const above = top + bounds.height > window.innerHeight - 12
    setPosition({ left, top: above ? bottom - bounds.height - 8 : top, above })
  }, [anchor, top, bottom, name])
  return createPortal(<span ref={ref} className="concept-orb-tooltip" data-above={position.above} style={{ left: position.left, top: position.top, '--tooltip-arrow-offset': `${anchor - position.left}px` } as CSSProperties} role="tooltip">{name}</span>, document.body)
}
