import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Course } from '../courseStore'
import { CourseCover } from './CourseCover'

function PinIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 6 6-3 1-3 4-2-2-5 5-1-1 5-5-2-2 4-3 1-3Z" /></svg>
}

export function CourseCard({ course, status, canDelete, busy, onOpen, onPin, onDelete, onLeave, leaveLabel }: {
  course: Course; status: string; canDelete: boolean; busy: boolean; onOpen: () => void; onPin: () => void; onDelete: () => void; onLeave?: () => void; leaveLabel?: string
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  function close(restoreFocus = false) { setPosition(null); if (restoreFocus) trigger.current?.focus() }
  function openFromButton() {
    const bounds = trigger.current!.getBoundingClientRect()
    setPosition({ left: bounds.right - 184, top: bounds.bottom + 6 })
  }

  useLayoutEffect(() => {
    if (!position || !menu.current) return
    const element = menu.current
    const bounds = element.getBoundingClientRect()
    element.style.left = `${Math.max(8, Math.min(position.left, window.innerWidth - bounds.width - 8))}px`
    element.style.top = `${Math.max(8, Math.min(position.top, window.innerHeight - bounds.height - 8))}px`
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [position])

  useEffect(() => {
    if (!position) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPosition(null); trigger.current?.focus() }
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
  }, [position])

  return <div className="course-card-wrap" onContextMenu={event => {
    event.preventDefault()
    if (!busy) setPosition({ left: event.clientX, top: event.clientY })
  }} onKeyDown={event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      if (!busy) openFromButton()
    }
  }}>
    <button type="button" className="course-card" onClick={onOpen}>
      {course.banner?.type !== 'none' && <CourseCover banner={course.banner} imageUrl={course.bannerUrl} />}
      <span className="course-card-body"><strong>{course.name}</strong><span>{status}</span></span>
    </button>
    {course.pinned && <span className="course-card-pinned" title="Pinned" role="img" aria-label="Pinned"><PinIcon /></span>}
    <button ref={trigger} type="button" className="course-menu-trigger" aria-label={`Options for ${course.name}`} aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? menuId : undefined} disabled={busy} onClick={() => position ? close() : openFromButton()} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openFromButton() }
    }}><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" /></svg></button>
    {position && createPortal(<div ref={menu} id={menuId} className="course-card-menu" role="menu" aria-label={`Options for ${course.name}`} style={{ left: position.left, top: position.top }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }
    }}>
      <button type="button" role="menuitem" disabled={busy} onClick={() => { close(true); onPin() }}><PinIcon />{course.pinned ? 'Unpin course' : 'Pin course'}</button>
      {onLeave && <button type="button" role="menuitem" className="course-menu-delete" disabled={busy} onClick={() => { close(true); onLeave() }}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H3v14h5M7 10h10m-4-4 4 4-4 4" /></svg>{leaveLabel ?? 'Leave course'}</button>}
      {canDelete && <button type="button" role="menuitem" className="course-menu-delete" disabled={busy} onClick={() => { close(true); onDelete() }}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 5h14M8 2h4l1 3M5 5l1 12h8l1-12M8 8v6m4-6v6" /></svg>Delete course</button>}
    </div>, document.body)}
  </div>
}
