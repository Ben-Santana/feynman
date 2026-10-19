import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ChatText, chatTextParts } from './ChatText'
import './ChatMessage.css'

export function ThoughtCloud({ thinking = true, transferring = false }: { thinking?: boolean; transferring?: boolean }) {
  return <span className="avatar-thought" data-thinking={thinking} data-active={thinking || transferring} role={thinking ? 'status' : undefined} aria-label={thinking ? 'Thinking' : undefined} aria-hidden={!thinking}>
    <svg viewBox="0 0 112 82" aria-hidden="true">
      <rect className="thought-cloud" x="12" y="10" width="92" height="48" rx="24" />
      <circle className="thought-trail thought-trail-near" cx="26" cy="69" r="6" />
      <circle className="thought-trail thought-trail-far" cx="15" cy="79" r="3" />
      {[42, 59, 76].map((cx, index) => <circle key={cx} className={`thought-dot thought-dot-${index}`} cx={cx} cy="34" r="4" />)}
    </svg>
  </span>
}

// A complete, hidden copy reserves the final text layout while the visible copy
// types in. Math stays whole as it appears, so partial LaTeX never flashes.
function ReplyText({ content, progress }: { content: string; progress: number }) {
  if (progress >= 1) return <ChatText>{content}</ChatText>
  const end = Math.floor(content.length * progress)
  const visible = chatTextParts(content).reduce((result, part) => {
    const count = Math.max(0, Math.min(end - result.offset, part.source.length))
    const text = part.math ? count === part.source.length ? part.source : '' : part.source.slice(0, count)
    return { text: result.text + text, offset: result.offset + part.source.length }
  }, { text: '', offset: 0 }).text
  return <div className="reply-text-reveal">
    <div className="reply-text-size" aria-hidden="true"><ChatText>{content}</ChatText></div>
    <div className="reply-text-visible" aria-hidden="true"><ChatText>{visible}</ChatText></div>
    <span className="sr-only">{content}</span>
  </div>
}

export function ChatMessage({ role, name, content, className = '', avatarRef, arrive = false, onArrived, feedback, boardImage, children }: {
  role: 'user' | 'assistant'; name: string; content: string; className?: string
  avatarRef: RefObject<HTMLDivElement | null>; arrive?: boolean; onArrived: () => void
  feedback?: ReactNode; boardImage?: string; children?: ReactNode
}) {
  const bubble = useRef<HTMLDivElement>(null)
  const orb = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState(arrive ? 'flight' : 'done')
  const [progress, setProgress] = useState(arrive ? 0 : 1)

  useLayoutEffect(() => {
    if (!arrive) return
    const host = bubble.current
    const source = avatarRef.current
    const ball = orb.current
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!host || !source || !ball || media.matches) {
      setPhase('done'); setProgress(1); onArrived()
      return
    }
    let disposed = false
    let frame = 0
    const animations: Animation[] = []
    const finish = () => {
      if (disposed) return
      setPhase('done'); setProgress(1); onArrived()
    }
    const reduceMotion = () => { if (media.matches) { animations.forEach(animation => animation.cancel()); cancelAnimationFrame(frame); finish() } }
    media.addEventListener('change', reduceMotion)

    async function deliver() {
      // Scroll first, then measure the actual destination in viewport space.
      const list = host!.closest('.chat-messages')
      if (list) list.scrollTop = list.scrollHeight
      const surface = host!.classList.contains('chat-message-with-paper') ? host!.querySelector('.chat-message-copy') || host! : host!
      const target = surface.getBoundingClientRect()
      const surfaceStyle = getComputedStyle(surface)
      // The traveling ball is also the expanding bubble. Match its final paint
      // and bounds exactly so revealing the real message has no visual seam.
      ball!.style.background = surfaceStyle.backgroundColor
      ball!.style.boxShadow = surfaceStyle.boxShadow
      ball!.style.border = surfaceStyle.border
      const thought = source!.querySelector('.thought-cloud')
      const origin = thought?.getBoundingClientRect() ?? source!.getBoundingClientRect()
      const x = origin.left + origin.width * (thought ? .5 : .66)
      const y = origin.top + origin.height * (thought ? .5 : .43)
      const toX = target.left + Math.min(36, target.width / 2)
      const toY = target.top + Math.min(30, target.height / 2)
      const flightShadow = '0 5px 12px rgb(0 0 0 / .18)'
      const thoughtColor = thought ? getComputedStyle(thought).fill : surfaceStyle.backgroundColor
      const thoughtContainer = source!.querySelector('.avatar-thought')
      const thoughtOpacity = thoughtContainer ? getComputedStyle(thoughtContainer).opacity : '1'
      // Freeze the dots and tail at their last painted positions. They gather
      // into the center as the same white surface contracts into a ball.
      if (thought) {
        ball!.replaceChildren()
        for (const detail of source!.querySelectorAll('.thought-dot, .thought-trail')) {
          const bounds = detail.getBoundingClientRect()
          const style = getComputedStyle(detail)
          const copy = document.createElement('span')
          Object.assign(copy.style, {
            position: 'absolute', left: `${bounds.left - origin.left}px`, top: `${bounds.top - origin.top}px`,
            width: `${bounds.width}px`, height: `${bounds.height}px`, borderRadius: '50%', background: style.fill,
          })
          ball!.append(copy)
          animations.push(copy.animate([
            { opacity: style.opacity, transform: 'translate(0, 0) scale(1)' },
            { opacity: 0, transform: `translate(${12 - (bounds.left - origin.left) - bounds.width / 2}px, ${12 - (bounds.top - origin.top) - bounds.height / 2}px) scale(.3)` },
          ], { duration: 140, easing: 'ease-in', fill: 'both' }))
        }
      }
      const flight = ball!.animate([
        { opacity: thoughtOpacity, backgroundColor: thoughtColor, boxShadow: '0 2px 4px rgb(0 0 0 / .1)', width: `${thought ? origin.width : 24}px`, height: `${thought ? origin.height : 24}px`, borderRadius: `${thought ? origin.height / 2 : 12}px`, transform: `translate3d(${thought ? origin.left : x - 12}px, ${thought ? origin.top : y - 12}px, 0)`, offset: 0, easing: 'ease-in-out' },
        { opacity: 1, backgroundColor: thoughtColor, boxShadow: flightShadow, width: '24px', height: '24px', borderRadius: '12px', transform: `translate3d(${x - 12}px, ${y - 12}px, 0)`, offset: .24, easing: 'ease-in-out' },
        { opacity: 1, backgroundColor: thoughtColor, boxShadow: flightShadow, width: '24px', height: '24px', borderRadius: '12px', transform: `translate3d(${toX - 12}px, ${toY - 12}px, 0)`, offset: .72, easing: 'ease-in-out' },
        { opacity: 1, backgroundColor: surfaceStyle.backgroundColor, boxShadow: surfaceStyle.boxShadow, width: `${target.width}px`, height: `${target.height}px`, borderRadius: surfaceStyle.borderRadius, transform: `translate3d(${target.left}px, ${target.top}px, 0)`, offset: 1 },
      ], { duration: 650, fill: 'both' })
      animations.push(flight)
      try {
        await flight.finished
        if (disposed) return
        setPhase('typing')
        const started = performance.now()
        const duration = Math.min(500, Math.max(150, content.length * .7))
        const type = (now: number) => {
          if (disposed) return
          const next = Math.min(1, (now - started) / duration)
          setProgress(next)
          if (next < 1) frame = requestAnimationFrame(type)
          else finish()
        }
        frame = requestAnimationFrame(type)
      } catch { /* Cancellation on navigation or reduced motion ends the flight. */ }
    }
    // Capture the cloud and replace it before paint, avoiding an empty frame
    // between the thinking state and the start of delivery.
    void deliver()
    return () => {
      disposed = true; cancelAnimationFrame(frame)
      animations.forEach(animation => animation.cancel())
      media.removeEventListener('change', reduceMotion)
    }
  }, [arrive, avatarRef, content, onArrived])

  return <>
    {phase === 'flight' && createPortal(<div ref={orb} className="reply-orb" aria-hidden="true" />, document.body)}
    <div ref={bubble} className={`chat-message ${role} ${className}`} data-arrival={phase} aria-busy={phase !== 'done'}>
      <div className="chat-message-copy">
        <span>{name}</span>
        <div className="chat-message-text"><ReplyText content={content} progress={progress} /></div>
        {feedback}
        {boardImage && <img className="chat-board-image" src={boardImage} alt="Whiteboard shared with this message" />}
      </div>
      {children}
    </div>
  </>
}
