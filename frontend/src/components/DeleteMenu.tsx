import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './DeleteMenu.css'

export function DeleteMenu({ children, label, action, onDelete, disabled = false, className = '' }: {
  children: ReactNode; label: string; action: string; onDelete?: () => void; disabled?: boolean; className?: string
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const menuId = useId()
  const open = Boolean(position && onDelete && !disabled)
  function close(restoreFocus = false) {
    setPosition(null)
    if (restoreFocus) returnFocus.current?.focus()
  }
  function openFromButton() {
    const bounds = trigger.current!.getBoundingClientRect()
    returnFocus.current = trigger.current
    setPosition({ left: bounds.right - 184, top: bounds.bottom + 6 })
  }
  useLayoutEffect(() => {
    if (!open || !position || !menu.current) return
    const bounds = menu.current.getBoundingClientRect()
    menu.current.style.left = `${Math.max(8, Math.min(position.left, window.innerWidth - bounds.width - 8))}px`
    menu.current.style.top = `${Math.max(8, Math.min(position.top, window.innerHeight - bounds.height - 8))}px`
    menu.current.querySelector('button')?.focus()
  }, [open, position])
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPosition(null); returnFocus.current?.focus() }
    }
    const dismiss = () => setPosition(null)
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) dismiss() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [open])

  return <div className={`delete-menu-wrap ${className}`} onContextMenu={event => {
    if (!onDelete) return
    event.preventDefault()
    if (disabled) return
    returnFocus.current = event.currentTarget.querySelector('button')
    setPosition({ left: event.clientX, top: event.clientY })
  }} onKeyDown={event => {
    if (onDelete && !disabled && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
      event.preventDefault(); openFromButton()
    }
  }}>
    {children}
    {onDelete && <button ref={trigger} type="button" className="delete-menu-trigger" aria-label={`Options for ${label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={disabled} onClick={() => open ? close() : openFromButton()} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openFromButton() }
    }}>⋯</button>}
    {open && position && createPortal(<div ref={menu} id={menuId} className="delete-context-menu" role="menu" aria-label={`Options for ${label}`} style={position} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); menu.current?.querySelector('button')?.focus() }
    }}><button type="button" role="menuitem" onClick={() => { close(true); onDelete?.() }}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 5h14M8 2h4l1 3M5 5l1 12h8l1-12M8 8v6m4-6v6" /></svg>{action}</button></div>, document.body)}
  </div>
}
