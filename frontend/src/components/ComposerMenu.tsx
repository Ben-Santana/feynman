import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function ComposerMenu({ onOpen, children }: { onOpen: () => void; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  function close() {
    setOpen(false)
    if (menu.current?.contains(document.activeElement)) trigger.current?.focus()
  }

  return <div
    ref={menu}
    className="composer-menu"
    // Keep the draft focused so the phone keyboard stays up and the cursor stays put.
    onMouseDown={event => { onOpen(); event.preventDefault() }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => { if (open && event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() } }}
  >
    <button ref={trigger} type="button" className="composer-menu-toggle" aria-label={open ? 'Close message options' : 'Open message options'} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>
    <div id={panelId} className="composer-menu-panel" hidden={!open}>{children(close)}</div>
  </div>
}
