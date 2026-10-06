import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import 'katex/dist/katex.min.css'
import { mathProps } from './mathRendering'
import { paperParts } from './paperContent'
import { collectPaperGrades, nextUngradedDeck, paperPosition, rotatePaperDeck } from './paperDeck'
import './PaperStamp.css'

export type Exercise = { id: string; markdown: string; problem?: string; steps?: string[]; conclusion?: string }
export type Paper = Exercise & { papers?: Exercise[] }
export type PaperGrade = { paperId: string; grade: 'pass' | 'fail'; selectedSteps: number[] }
export type Review = { paperId: string; grade?: 'pass' | 'fail'; selectedSteps?: number[]; grades?: PaperGrade[]; explanation: string }
export function MathText({ children }: { children: string }) {
  const spacedMath = children.split(/(\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]+\$)/g).map(part => {
    if (part.startsWith('$') && !part.startsWith('$$') && /\\(?:frac|dfrac|tfrac)/.test(part)) {
      return `\n\n$$\n${part.slice(1, -1)}\n$$\n\n`
    }
    return part
  }).join('')
  return <Markdown {...mathProps} components={{ img: () => null, a: ({ children }) => <span>{children}</span> }}>{spacedMath}</Markdown>
}

export function PaperReview({ paper, review, busy, error, onSubmit }: { paper: Paper; review?: Review; busy: boolean; error?: string; onSubmit: (review: Review) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const preview = useRef<HTMLSpanElement>(null)
  const stamp = useRef<HTMLSpanElement>(null)
  const stampStage = useRef<HTMLSpanElement>(null)
  const stampShadow = useRef<HTMLSpanElement>(null)
  const ink = useRef<HTMLSpanElement>(null)
  const impact = useRef<HTMLSpanElement>(null)
  const gradeButton = useRef<HTMLButtonElement>(null)
  const gradeLock = useRef(false)
  const animations = useRef(new Set<Animation>())
  const mounted = useRef(true)
  const exercises = paper.papers?.length ? paper.papers : [paper]
  const reviewedGrades = review?.grades || (review?.grade ? [{ paperId: paper.id, grade: review.grade, selectedSteps: review.selectedSteps || [] }] : [])
  const [grades, setGrades] = useState<PaperGrade[]>([])
  const [drafts, setDrafts] = useState<Record<string, number[]>>({})
  const [order, setOrder] = useState(() => exercises.map((_, index) => index))
  const [turning, setTurning] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [stamped, setStamped] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const currentIndex = order[0]
  const current = exercises[currentIndex]
  const savedGrades = review ? reviewedGrades : grades
  const selected = review ? savedGrades.find(item => item.paperId === current.id)?.selectedSteps || [] : drafts[current.id] ?? grades.find(item => item.paperId === current.id)?.selectedSteps ?? []
  const grade = review ? savedGrades.find(item => item.paperId === current.id)?.grade || 'pass' : selected.length ? 'fail' : 'pass'
  const locked = busy || sorting || turning
  useEffect(() => {
    mounted.current = true
    const activeAnimations = animations.current
    return () => {
      mounted.current = false
      activeAnimations.forEach(animation => animation.cancel())
    }
  }, [])
  function animate(element: HTMLElement | null, frames: Keyframe[], options: KeyframeAnimationOptions, hold = false) {
    if (!element) return Promise.resolve()
    const animation = element.animate(frames, options)
    animations.current.add(animation)
    return animation.finished.then(() => animation).catch(() => undefined).finally(() => {
      if (!hold) {
        animations.current.delete(animation)
        animation.cancel()
      }
    })
  }
  function openPaper() {
    const modal = dialog.current
    if (!modal || modal.open) return
    const source = preview.current?.getBoundingClientRect()
    modal.showModal()
    modal.focus({ preventScroll: true })
    if (!source || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const sheet = modal.querySelector<HTMLElement>('.paper-stack')
    if (!sheet) return
    const target = sheet.getBoundingClientRect()
    void animate(sheet, [
      { transform: `translate(${source.left + source.width / 2 - target.left - target.width / 2}px, ${source.top + source.height / 2 - target.top - target.height / 2}px) rotate(14deg) scale(${source.width / target.width}, ${source.height / target.height})`, opacity: 0.65 },
      { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
    ], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' })
  }
  function toggle(step: number) {
    if (review || locked || gradeLock.current) return
    const next = selected.includes(step) ? selected.filter(n => n !== step) : [...selected, step].sort((a, b) => a - b)
    setDrafts(items => ({ ...items, [current.id]: next }))
    setGrades(items => items.filter(item => item.paperId !== current.id))
    setStamped(false)
  }
  async function turnStack(nextOrder: number[], direction: -1 | 1) {
    if (exercises.length < 2 || nextOrder[0] === order[0]) return
    const travelling = direction === 1 ? order[0] : nextOrder[0]
    const sheet = dialog.current?.querySelector<HTMLElement>(`.paper-sheet[data-paper-index="${travelling}"]`) || null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTurning(true)
    try {
      const side = `translate3d(${direction * 78}%,-3%,70px) rotateZ(${direction * 9}deg)`
      const departure = reducedMotion ? undefined : await animate(sheet, [
        { transform: paperPosition(order.indexOf(travelling)) },
        { transform: side },
      ], { duration: 360, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' }, true)
      if (!mounted.current) return
      setOrder(nextOrder)
      setStamped(false)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (!mounted.current) return
      if (!reducedMotion) {
        const depth = nextOrder.indexOf(travelling)
        const returning = animate(sheet, [
          { transform: `translate3d(${direction * 78}%,-3%,${depth ? -depth * 3 : 70}px) rotateZ(${direction * 9}deg)` },
          { transform: paperPosition(depth) },
        ], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' })
        if (departure) { departure.cancel(); animations.current.delete(departure) }
        await returning
      }
      if (mounted.current) setAnnouncement(`Paper ${nextOrder[0] + 1} of ${exercises.length}.`)
    } finally {
      if (mounted.current) setTurning(false)
    }
  }
  async function browse(direction: -1 | 1) {
    if (locked || gradeLock.current || exercises.length < 2) return
    gradeLock.current = true
    try { await turnStack(rotatePaperDeck(order, direction), direction) }
    finally {
      gradeLock.current = false
      requestAnimationFrame(() => {
        if (mounted.current && dialog.current?.open) dialog.current.focus({ preventScroll: true })
      })
    }
  }
  async function finalizeGrade() {
    if (review || busy || gradeLock.current) return
    gradeLock.current = true
    setSorting(true)
    setStamped(false)
    const next = collectPaperGrades(exercises, grades, { paperId: current.id, grade, selectedSteps: grade === 'fail' ? selected : [] })
    try {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const sheet = dialog.current?.querySelector<HTMLElement>('.paper-stack') || null
      // Bring the grade box into view before the stamp arrives, even on long papers.
      dialog.current?.querySelector('.paper-sheet-top .paper-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
      const targetBounds = gradeButton.current?.getBoundingClientRect()
      const sheetBounds = sheet?.getBoundingClientRect()
      if (stamp.current && stampStage.current && targetBounds && sheetBounds) {
        stampStage.current.style.left = `${targetBounds.left + targetBounds.width / 2 - sheetBounds.left}px`
        stampStage.current.style.top = `${targetBounds.top - sheetBounds.top + 31 + (targetBounds.height - 39) / 2 - stamp.current.offsetHeight / 2}px`
      }
      if (!reducedMotion) {
        const duration = 1500
        const contact = 680
        const at = (milliseconds: number) => milliseconds / duration
        await Promise.all([
          animate(sheet, [
            { transform: 'rotateX(0deg) translateY(0px) scale(1)', offset: 0, easing: 'cubic-bezier(.4,0,.2,1)' },
            { transform: 'rotateX(32deg) translateY(0px) scale(.97)', offset: at(360) },
            { transform: 'rotateX(32deg) translateY(0px) scale(.97)', offset: at(contact) },
            { transform: 'rotateX(32deg) translateY(1.5px) scale(.969)', offset: at(contact + 10) },
            { transform: 'rotateX(32deg) translateY(-.5px) scale(.9705)', offset: at(contact + 30) },
            { transform: 'rotateX(32deg) translateY(0px) scale(.97)', offset: at(contact + 65) },
            { transform: 'rotateX(32deg) translateY(0px) scale(.97)', offset: at(1080), easing: 'cubic-bezier(.4,0,.2,1)' },
            { transform: 'rotateX(0deg) translateY(0px) scale(1)', offset: 1 },
          ], { duration, easing: 'linear' }),
          animate(stamp.current, [
            { visibility: 'visible', transform: 'translate3d(0,-14px,140px) rotateZ(-7deg)', offset: 0 },
            { visibility: 'visible', transform: 'translate3d(0,-14px,140px) rotateZ(-7deg)', offset: at(400), easing: 'cubic-bezier(.4,0,.6,1)' },
            { visibility: 'visible', transform: 'translate3d(0,0,0) rotateZ(-7deg)', offset: at(contact), easing: 'ease-out' },
            { visibility: 'visible', transform: 'translate3d(0,0,-1px) rotateZ(-7deg)', offset: at(contact + 10), easing: 'ease-out' },
            { visibility: 'visible', transform: 'translate3d(0,0,5px) rotateZ(-7deg)', offset: at(contact + 40), easing: 'ease-in-out' },
            { visibility: 'visible', transform: 'translate3d(0,0,2px) rotateZ(-7deg)', offset: at(contact + 90) },
            { visibility: 'visible', transform: 'translate3d(0,0,2px) rotateZ(-7deg)', offset: at(860), easing: 'cubic-bezier(.4,0,.6,1)' },
            { visibility: 'visible', transform: 'translate3d(0,-20px,180px) rotateZ(-7deg)', offset: at(1250) },
            { visibility: 'hidden', transform: 'translate3d(0,-28px,200px) rotateZ(-7deg)', offset: at(1340) },
            { visibility: 'hidden', transform: 'translate3d(0,-28px,200px) rotateZ(-7deg)', offset: 1 },
          ], { duration, easing: 'linear' }),
          animate(stampShadow.current, [
            { opacity: 0, filter: 'blur(16px)', transform: 'translateZ(.1px) rotate(-7deg) scale(1.25)', offset: 0 },
            { opacity: .12, filter: 'blur(16px)', transform: 'translateZ(.1px) rotate(-7deg) scale(1.25)', offset: at(400), easing: 'cubic-bezier(.4,0,.6,1)' },
            { opacity: .3, filter: 'blur(2px)', transform: 'translateZ(.1px) rotate(-7deg) scale(1)', offset: at(contact) },
            { opacity: .25, filter: 'blur(3px)', transform: 'translateZ(.1px) rotate(-7deg) scale(1)', offset: at(860), easing: 'ease-in-out' },
            { opacity: 0, filter: 'blur(18px)', transform: 'translateZ(.1px) rotate(-7deg) scale(1.3)', offset: at(1340) },
            { opacity: 0, filter: 'blur(18px)', transform: 'translateZ(.1px) rotate(-7deg) scale(1.3)', offset: 1 },
          ], { duration, easing: 'linear' }),
          animate(ink.current, [
            { opacity: 0, transform: 'rotate(-7deg) scale(1.04)', offset: 0 },
            { opacity: .9, transform: 'rotate(-7deg) scale(.995)', offset: .04 },
            { opacity: .84, transform: 'rotate(-7deg) scale(1)', offset: .09 },
            { opacity: .84, transform: 'rotate(-7deg) scale(1)', offset: 1 },
          ], { delay: contact, duration: duration - contact, fill: 'backwards', easing: 'linear' }),
          animate(impact.current, [
            { opacity: 0, transform: 'scale(.7)', offset: 0 },
            { opacity: .2, transform: 'scale(.8)', offset: .08 },
            { opacity: 0, transform: 'scale(1.12)', offset: 1 },
          ], { delay: contact, duration: 160, fill: 'backwards', easing: 'ease-out' }),
        ])
      }
      if (!mounted.current) return
      setStamped(true)
      setAnnouncement(`Paper ${currentIndex + 1} stamped ${grade}. ${exercises.length - next.length} remaining.`)
      if (next.length !== exercises.length) {
        setGrades(next)
        await turnStack(nextUngradedDeck(order, exercises, next), 1)
        return
      }
      const submitted: Review = paper.papers?.length
        ? { paperId: paper.id, grades: next, explanation: '' }
        : { paperId: paper.id, grade, selectedSteps: next[0].selectedSteps, explanation: '' }
      if (await onSubmit(submitted)) dialog.current?.close()
      else { setStamped(false); setAnnouncement('Could not submit the grades. Please try again.') }
    } catch {
      setStamped(false)
      setAnnouncement('Could not submit the grades. Please try again.')
    } finally {
      gradeLock.current = false
      if (mounted.current) {
        setSorting(false)
        requestAnimationFrame(() => {
          if (mounted.current && dialog.current?.open) gradeButton.current?.focus({ preventScroll: true })
        })
      }
    }
  }
  return <>
    <button type="button" className="paper-peek" onClick={openPaper} aria-label={review ? 'View graded papers' : 'Grade papers'} title={review ? 'View graded papers' : 'Grade papers'}><span ref={preview} className="paper-peek-sheet" aria-hidden="true"><span className="paper-peek-heading" /><span className="paper-peek-line" /><span className="paper-peek-line" /><span className="paper-peek-line short" /><span className="paper-peek-mark">{review ? '✓' : '?'}</span></span><span className="sr-only">{review ? 'View graded papers' : 'Grade papers'}</span></button>
    <dialog className={`paper-dialog paper-stamp-dialog ${exercises.length > 1 ? 'paper-dialog-deck' : ''} ${sorting ? 'paper-is-stamping' : ''} ${turning ? 'paper-is-turning' : ''}`} ref={dialog} aria-label="Classroom papers" tabIndex={-1} onCancel={event => { if (sorting || turning) event.preventDefault() }} onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); void browse(event.key === 'ArrowLeft' ? -1 : 1) }
    }}>
      <button type="button" className="paper-close" aria-label="Close papers" disabled={sorting || turning} onClick={() => dialog.current?.close()}><svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" aria-hidden="true"><path d="M7 8 C18 18 35 39 49 49" /><path d="M48 7 C38 17 20 39 8 48" /><path d="M9 9 C21 22 36 40 48 48" strokeWidth="1.4" opacity=".45" /></svg></button>
      <div className={`paper-workspace ${exercises.length > 1 ? 'paper-workspace-deck' : ''}`}>
        {exercises.length > 1 && <button type="button" className="paper-side-nav" disabled={locked} onClick={() => void browse(-1)} aria-label="Previous paper" aria-keyshortcuts="ArrowLeft"><svg viewBox="0 0 32 48" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M25 5 C21 9 19 13 15 17 C12 21 9 22 7 24 C11 29 13 33 17 37 C20 41 22 43 25 44" /><path d="M26 6 C21 12 13 20 8 25 C13 31 19 40 24 43" strokeWidth="1.4" opacity=".5" /></svg></button>}
        <div className="paper-stack">
          {exercises.map((exercise, index) => {
            const depth = order.indexOf(index)
            const top = depth === 0
            const saved = savedGrades.find(item => item.paperId === exercise.id)
            const marks = review ? saved?.selectedSteps || [] : drafts[exercise.id] ?? saved?.selectedSteps ?? []
            const sheetGrade = review ? saved?.grade || 'pass' : marks.length ? 'fail' : 'pass'
            const { problem, steps, conclusion } = paperParts(exercise)
            return <div key={exercise.id} data-paper-index={index} className={`paper-sheet ${top ? 'paper-sheet-top' : ''}`} style={{ transform: paperPosition(depth), zIndex: exercises.length - depth }} inert={!top} aria-hidden={!top}>
          <div className="paper-scroll">
            <article className="paper-document">
              <div className="paper-heading">
                <div className="paper-problem"><strong className="paper-problem-number">{index + 1}.</strong><div className="paper-problem-text"><MathText>{problem}</MathText></div></div>
                <div className={`paper-stamp-target paper-grade-${sheetGrade} ${saved || top && stamped ? 'paper-is-inked' : ''}`}>
                  {review ? <div className="paper-grade-field" aria-label={`Grade: ${sheetGrade}`}><span className="paper-grade-label">Reviewed</span></div> : <button ref={top ? gradeButton : undefined} type="button" className="paper-grade-field" onClick={() => void finalizeGrade()} disabled={!top || locked} aria-label={`Grade paper ${index + 1} ${sheetGrade}; click to finalize`}><span className="paper-grade-label">{top && sorting ? 'Stamping' : saved ? 'Re-stamp' : 'Click to stamp'}</span><span className="paper-grade-ghost" aria-hidden="true">{sheetGrade}</span></button>}
                  <span ref={top ? ink : undefined} className="paper-stamp-ink" aria-hidden="true"><span>{sheetGrade}</span><small>Feynman · reviewed</small></span>
                  <span ref={top ? impact : undefined} className="paper-stamp-impact" aria-hidden="true" />
                </div>
              </div>
              <div className="paper-steps">{steps.map((step, i) => {
                const marked = marks.includes(i + 1)
                return <button type="button" key={i} className={`paper-step ${marked ? 'paper-step-selected' : ''}`} onClick={() => toggle(i + 1)} disabled={!top || Boolean(review) || locked} aria-pressed={marked} aria-label={`Step ${i + 1}${marked ? ', marked incorrect' : ''}`}><span className="paper-step-body"><MathText>{step}</MathText></span><svg className="paper-step-mark" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" aria-hidden="true"><path d="M6 7 C16 14 24 27 38 38" /><path d="M37 6 C29 16 17 29 6 37" /></svg></button>
              })}</div>
              <h2 className="sr-only">Final answer</h2><div className="paper-conclusion"><MathText>{conclusion}</MathText></div>
              {top && error && <p className="paper-error" role="alert">{error}</p>}
            </article>
          </div>
          </div>})}
          <span ref={stampStage} className="paper-stamp-stage" style={{ zIndex: exercises.length + 2 }} aria-hidden="true">
            <span ref={stampShadow} className="paper-stamp-shadow" />
            <span ref={stamp} className={`paper-stamp-tool paper-grade-${grade}`}>
              <span className="paper-stamp-rubber" />
              {Array.from({ length: 9 }, (_, index) => <span key={index} className="paper-stamp-wall" style={{ transform: `translateZ(${4 + index * 4}px)` }} />)}
              <span className="paper-stamp-face" />
            </span>
          </span>
        </div>
        {exercises.length > 1 && <button type="button" className="paper-side-nav" disabled={locked} onClick={() => void browse(1)} aria-label="Next paper" aria-keyshortcuts="ArrowRight"><svg viewBox="0 0 32 48" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5 C11 10 14 13 17 17 C21 21 23 23 25 24 C21 29 18 33 15 37 C12 40 10 42 8 44" /><path d="M6 6 C12 12 20 20 24 25 C19 32 13 40 9 43" strokeWidth="1.4" opacity=".5" /></svg></button>}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </dialog>
  </>
}
