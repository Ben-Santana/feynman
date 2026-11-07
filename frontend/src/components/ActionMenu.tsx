import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ActionMenu.css'

export type ActionMenuItem = { label: string; onSelect: () => void; danger?: boolean }

export function ActionMenu({ label, items, disabled = false }: { label: string; items: ActionMenuItem[]; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<{ right: number; top: number; bottom: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const open = Boolean(anchor && !disabled)
  function openMenu() {
    const { right, top, bottom } = trigger.current!.getBoundingClientRect()
    setAnchor({ right, top, bottom })
  }
  function close(restoreFocus = false) {
    setAnchor(null)
    if (restoreFocus) trigger.current?.focus()
  }
  useLayoutEffect(() => {
    if (!open || !anchor || !menu.current) return
    const { width, height } = menu.current.getBoundingClientRect()
    const below = anchor.bottom + 6
    const top = below + height + 8 <= window.innerHeight ? below : anchor.top - height - 6
    menu.current.style.left = `${Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))}px`
    menu.current.style.top = `${Math.max(8, top)}px`
    menu.current.querySelector('button')?.focus()
  }, [open, anchor])
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setAnchor(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setAnchor(null); trigger.current?.focus() }
    }
    const dismiss = () => setAnchor(null)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])
  function moveFocus(key: string) {
    const buttons = [...(menu.current?.querySelectorAll('button') ?? [])]
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = key === 'Home' ? 0 : key === 'End' ? buttons.length - 1 : (current + (key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return <>
    <button ref={trigger} type="button" className="action-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={disabled} onClick={() => open ? close() : openMenu()} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openMenu() }
    }}>
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
    </button>
    {open && createPortal(<div ref={menu} id={menuId} className="action-menu" role="menu" aria-label={label} onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); moveFocus(event.key) }
      if (event.key === 'Tab') close()
    }}>
      {items.map(item => <button key={item.label} type="button" role="menuitem" className={item.danger ? 'action-menu-danger' : undefined} onClick={() => { close(true); item.onSelect() }}>{item.label}</button>)}
    </div>, document.body)}
  </>
}
