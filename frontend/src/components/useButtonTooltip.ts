import { useEffect, useId, useState } from 'react'

export type TooltipAnchor = { left: number; top: number }

export function useButtonTooltip() {
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null)
  const id = useId()
  const hide = () => setAnchor(null)
  useEffect(() => {
    if (!anchor) return
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [anchor])
  return {
    show(element: HTMLElement) {
      const bounds = element.getBoundingClientRect()
      setAnchor({ left: bounds.left + bounds.width / 2, top: bounds.top - 8 })
    },
    hide,
    describedBy: anchor ? id : undefined,
    anchor,
    id,
  }
}

