import { useEffect, useId, useState } from 'react'

export type TooltipAnchor = { left: number; top: number }

export function useButtonTooltip() {
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null)
  const id = useId()
  const hide = () => setAnchor(null)
  const visible = anchor !== null
  useEffect(() => {
    if (!visible) return
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [visible])
  return {
    showAt(clientX: number, clientY: number) {
      setAnchor({ left: clientX, top: Math.max(36, clientY - 12) })
    },
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

