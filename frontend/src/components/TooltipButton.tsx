import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { useButtonTooltip, type TooltipAnchor } from './useButtonTooltip'

export function ButtonTooltip({ id, text, anchor, variant = 'default' }: { id: string; text: string; anchor: TooltipAnchor; variant?: 'default' | 'warning' }) {
  const element = useRef<HTMLSpanElement>(null)
  const [left, setLeft] = useState(anchor.left)
  useLayoutEffect(() => {
    const halfWidth = (element.current?.getBoundingClientRect().width ?? 0) / 2
    setLeft(Math.max(halfWidth + 8, Math.min(anchor.left, window.innerWidth - halfWidth - 8)))
  }, [anchor.left, text])
  return createPortal(<span ref={element} id={id} className={`board-tooltip floating-button-tooltip${variant === 'warning' ? ' warning-tooltip' : ''}`} role="tooltip" style={{ left, top: variant === 'warning' ? anchor.top + 54 : anchor.top }}>{text}</span>, document.body)
}

export function TooltipButton({ tooltip, tooltipVariant, children, onPointerEnter, onPointerLeave, onFocus, onBlur, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tooltip: string; tooltipVariant?: 'default' | 'warning' }) {
  const hint = useButtonTooltip()
  return <>
    <button {...props} aria-describedby={hint.describedBy}
      onPointerEnter={event => { if (event.pointerType === 'mouse') hint.show(event.currentTarget); onPointerEnter?.(event) }}
      onPointerLeave={event => { hint.hide(); onPointerLeave?.(event) }}
      onFocus={event => { hint.show(event.currentTarget); onFocus?.(event) }}
      onBlur={event => { hint.hide(); onBlur?.(event) }}
      onClick={event => { hint.hide(); onClick?.(event) }}
    >{children}</button>
    {!props.disabled && hint.anchor && <ButtonTooltip id={hint.id} text={tooltip} anchor={hint.anchor} variant={tooltipVariant} />}
  </>
}
