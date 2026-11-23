import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { conceptFinished, targetCount, type Concept, type Level } from '../learningFlow'
import { guideChecklist, guideLevel, type GuideState } from '../teachingGuide.js'
import './ConceptChecklist.css'

type Anchor = { left: number; right: number; top: number; bottom: number; vertical: boolean }
type Open = { id: string; pinned: boolean; anchor: Anchor }
export type GuideStatus = 'ready' | 'preparing' | 'unavailable'

const levelNames: Record<Level, string> = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze' }
const stateLabels: Record<GuideState, string> = { done: 'Shown', corrected: 'Shown after fixing a mistake, half point', partial: 'Partly shown', open: 'Not shown yet' }
const edge = 12
const gap = 8

// Solid red is a full point. Dashed hatching is the half point for a fixed mistake.
function Mark({ state }: { state: GuideState }) {
  const hatch = useId()
  return <svg className="concept-checklist-mark" viewBox="0 0 14 14" aria-hidden="true">
    {state === 'corrected' && <defs><pattern id={hatch} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line className="concept-checklist-hatch" x1="0" y1="1.5" x2="3" y2="1.5" strokeDasharray="2 1" /></pattern></defs>}
    <circle cx="7" cy="7" r="6" style={state === 'corrected' ? { fill: `url(#${hatch})` } : undefined} />
    {state === 'done' && <path d="M4 7.2 6.2 9.4 10 5" />}
    {state === 'partial' && <path d="M7 1a6 6 0 0 0 0 12Z" />}
  </svg>
}

function ConceptChecklist({ id, concept, anchor, status, onPointerEnter, onPointerLeave }: { id: string; concept: Concept; anchor: Anchor; status: GuideStatus; onPointerEnter: () => void; onPointerLeave: () => void }) {
  const element = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const checklist = guideChecklist(concept)
  const level = guideLevel(concept)
  const levelCount = targetCount(concept.target)
  // Recomputed when the content changes size, such as when a checklist finishes preparing.
  // Beside a vertical rail the checklist narrows to the space left of it instead of covering the circles.
  const room = anchor.left - gap - edge
  const maxWidth = anchor.vertical && room >= 220 ? room : undefined
  const contentKey = `${concept.id}:${level}:${checklist ? `${checklist.groups.flatMap(group => group.prompts).length}:${checklist.waiting}` : status}`
  useLayoutEffect(() => {
    const bounds = element.current?.getBoundingClientRect()
    if (!bounds) return
    const clamp = (value: number, size: number, limit: number) => Math.max(edge, Math.min(value, limit - edge - size))
    const beside = anchor.left - gap - bounds.width
    const below = anchor.bottom + gap
    const above = anchor.top - gap - bounds.height
    // A vertical rail keeps its orbs visible: the checklist opens beside them.
    if (anchor.vertical && beside >= edge) setPosition({ left: beside, top: clamp(anchor.top, bounds.height, window.innerHeight) })
    else setPosition({ left: clamp((anchor.left + anchor.right) / 2 - bounds.width / 2, bounds.width, window.innerWidth), top: below + bounds.height <= window.innerHeight - edge || above < edge ? clamp(below, bounds.height, window.innerHeight) : above })
  }, [anchor.left, anchor.right, anchor.top, anchor.bottom, anchor.vertical, contentKey, maxWidth])
  return createPortal(<div ref={element} id={id} className="concept-checklist" role="tooltip" data-placed={position !== null} style={{ ...(position ?? { left: 0, top: 0 }), maxWidth }} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
    <p className="concept-checklist-name">{concept.name}</p>
    <p className="concept-checklist-level">{conceptFinished(concept) ? 'All levels finished' : `${levelNames[level]}, level ${Math.min(concept.passed + 1, levelCount)} of ${levelCount}`}</p>
    {checklist ? <>
      {checklist.groups.length > 0 && <ul className="concept-checklist-groups">{checklist.groups.map((group, index) => <li key={index}>
        <h3>{group.title}</h3>
        <ul className="concept-checklist-prompts">{group.prompts.map((prompt, promptIndex) => <li key={promptIndex} data-state={prompt.state}><Mark state={prompt.state} /><span>{prompt.text}<span className="sr-only"> ({stateLabels[prompt.state]})</span></span></li>)}</ul>
      </li>)}</ul>}
      {checklist.waiting && <div className="concept-checklist-waiting">
        <span className="concept-checklist-veil" aria-hidden="true"><i /><i /></span>
        <p>{checklist.groups.length ? 'Reply in the chat to see the next item.' : 'Teach first. Each item appears after you reply.'}</p>
      </div>}
      {checklist.later > 0 && <p className="concept-checklist-later"><span aria-hidden="true">{Array.from({ length: Math.min(checklist.later, 6) }, (_, dot) => <i key={dot} />)}</span>{checklist.later} more after {checklist.waiting ? 'that' : 'this'}</p>}
      <p className="concept-checklist-note">Each goal is worth 1 point: ½ if you fix a mistake, 0 if skipped or unfinished.</p>
    </> : <p className="concept-checklist-status" role="status">{status === 'preparing' ? 'Preparing checklist…' : 'No checklist for this level yet.'}</p>}
  </div>, document.body)
}

/** The row of concept progress circles. Each opens its teaching checklist on hover, focus, or tap. */
export function ConceptTracker({ concepts, active, waiting, overflow, guideStatus, onSelect, ref }: { concepts: Concept[]; active: string; waiting: Record<string, unknown>; overflow: boolean; guideStatus: GuideStatus; onSelect: (id: string) => void; ref: Ref<HTMLDivElement> }) {
  const popoverId = useId()
  const [open, setOpen] = useState<Open | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pointer = useRef('mouse')
  const shown = open ? concepts.find(concept => concept.id === open.id) : undefined

  const show = useCallback((id: string, pinned: boolean) => {
    clearTimeout(timer.current)
    const button = buttons.current.get(id)
    if (!button) return
    const bounds = button.getBoundingClientRect()
    const vertical = getComputedStyle(button.parentElement!).flexDirection === 'column'
    setOpen(current => ({ id, pinned: pinned || (current?.id === id && current.pinned), anchor: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, vertical } }))
  }, [])
  const close = useCallback(() => { clearTimeout(timer.current); setOpen(null) }, [])
  // The delay lets the pointer cross the gap into the checklist without closing it.
  const closeSoon = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(current => current?.pinned ? current : null), 220)
  }, [])
  const showSoon = useCallback((id: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => show(id, false), 120)
  }, [show])
  useEffect(() => () => clearTimeout(timer.current), [])

  const openId = open?.id
  useEffect(() => {
    if (!openId) return
    const inside = (target: EventTarget | null) => target instanceof Node && (document.getElementById(popoverId)?.contains(target) || [...buttons.current.values()].some(button => button.contains(target)))
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const onPointerDown = (event: PointerEvent) => { if (!inside(event.target)) close() }
    // Only a scroll that moves the circle closes it; reading a long checklist or a new chat message does not.
    const onScroll = (event: Event) => { if (event.target instanceof Node && event.target.contains(buttons.current.get(openId) ?? null)) close() }
    const onResize = () => show(openId, false)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [openId, popoverId, close, show])

  return <>
    <div ref={ref} className={`concept-tracker ${overflow ? 'concept-tracker-overflow' : ''}`} role="group" aria-label="Concept progress" tabIndex={overflow ? 0 : undefined}>
      {concepts.map(concept => {
        const loading = concept.id in waiting
        return <button key={concept.id} type="button" ref={node => { if (node) buttons.current.set(concept.id, node); else buttons.current.delete(concept.id) }} className={`concept-orb ${loading ? 'concept-orb-loading' : ''}`}
          onPointerDown={event => { pointer.current = event.pointerType }}
          onKeyDown={() => { pointer.current = 'keyboard' }}
          onClick={() => {
            onSelect(concept.id)
            if (pointer.current !== 'touch' && pointer.current !== 'pen') return
            // A tap has no hover: it opens the checklist, and a second tap closes it.
            if (open?.id === concept.id && open.pinned) close()
            else show(concept.id, true)
          }}
          onPointerEnter={event => { if (event.pointerType === 'mouse') showSoon(concept.id) }}
          onPointerLeave={event => { if (event.pointerType === 'mouse') closeSoon() }}
          onFocus={event => { if (event.currentTarget.matches(':focus-visible')) show(concept.id, false) }}
          onBlur={closeSoon}
          aria-label={`${concept.name}, ${concept.passed} of ${targetCount(concept.target)} target levels complete${loading ? ', waiting for a reply' : ''}`} aria-describedby={open?.id === concept.id ? popoverId : undefined} aria-busy={loading} aria-current={active === concept.id ? 'true' : undefined}>
          <svg className="concept-orb-visual" viewBox="0 0 32 32" aria-hidden="true"><circle className="concept-orb-track" cx="16" cy="16" r="13.75" /><circle className="concept-orb-progress" cx="16" cy="16" r="13.75" pathLength="100" strokeDasharray={`${Math.min(concept.passed / targetCount(concept.target), 1) * 100} 100`} />{loading && <g className="concept-orb-loader">{[0, 1, 2].map(trail => <circle key={trail} className="concept-orb-swirl" cx="16" cy="16" r="13.75" pathLength="100" />)}</g>}{active === concept.id && <circle className="concept-orb-selection" cx="16" cy="16" r="5" />}</svg>
        </button>
      })}
    </div>
    {open && shown && <ConceptChecklist id={popoverId} concept={shown} anchor={open.anchor} status={guideStatus} onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={closeSoon} />}
  </>
}
