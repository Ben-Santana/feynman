import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useButtonTooltip } from './useButtonTooltip'
import type { ReportGoal } from '../topicReports'

type ProofSection = { label: string; text?: string; quotes?: string[]; note?: string }

const MAX_ATTEMPTS = 3
const EDGE = 8
const replyCount = (count: number) => `${count} ${count === 1 ? 'reply' : 'replies'}`
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined
const quoted = (quote: string) => quote ? [quote] : []

function attemptsSection({ attempts }: ReportGoal['proof'], text?: string): ProofSection {
  return { label: attempts.length > MAX_ATTEMPTS ? `Last ${MAX_ATTEMPTS} of ${attempts.length} attempts` : attempts.length === 1 ? 'Your attempt' : 'Your attempts', text, quotes: attempts.slice(-MAX_ATTEMPTS) }
}

function proofSections({ outcome, proof, reason }: ReportGoal): ProofSection[] {
  const recovery = { label: 'How you recovered', text: proof.reason, quotes: quoted(proof.quote), note: dateLabel(proof.gotAt) }
  if (outcome === 'correct') return [{ label: proof.gotOnReply ? `Got it on reply ${proof.gotOnReply}` : 'Got it', quotes: quoted(proof.quote), note: dateLabel(proof.gotAt) }]
  if (outcome === 'corrected') return [{ label: 'What went wrong', text: proof.mistake?.reason, quotes: quoted(proof.mistake?.quote ?? '') }, recovery]
  if (outcome === 'slow') return [{ label: proof.returnedAfterSkip ? 'Skipped, then came back' : `Took ${replyCount(proof.replies)}` }, recovery]
  if (outcome === 'skipped') return [{ label: proof.replies ? `Skipped after ${replyCount(proof.replies)}` : 'Skipped' }, ...(proof.attempts.length ? [attemptsSection(proof)] : [])]
  return proof.attempts.length ? [{ label: 'Not finished' }, attemptsSection(proof, reason)] : [{ label: 'Not attempted' }]
}

function ProofCard({ id, goal, trigger }: { id: string; goal: ReportGoal; trigger: HTMLElement }) {
  const card = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    const anchor = trigger.getBoundingClientRect()
    const { width, height } = card.current!.getBoundingClientRect()
    const above = anchor.top - height - EDGE
    setPosition({
      left: Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE)),
      top: above >= EDGE ? above : Math.max(EDGE, Math.min(anchor.bottom + EDGE, window.innerHeight - height - EDGE)),
    })
  }, [trigger])
  return createPortal(<div ref={card} id={id} className="topic-report-proof" role="tooltip" style={position}>
    {proofSections(goal).map(section => <section key={section.label}>
      <strong>{section.label}</strong>
      {section.text && <p>{section.text}</p>}
      {section.quotes?.map(quote => <blockquote key={quote}>{quote}</blockquote>)}
      {section.note && <small>{section.note}</small>}
    </section>)}
  </div>, document.body)
}

export function ScoreProof({ goal, label }: { goal: ReportGoal; label: string }) {
  const hint = useButtonTooltip()
  const trigger = useRef<HTMLButtonElement>(null)
  // A tap focuses the button before clicking it, so the click must act on the state from before the tap.
  const openBeforePress = useRef(false)
  return <>
    <button ref={trigger} type="button" className={`topic-report-item-score topic-report-item-${goal.outcome}`} aria-label={`${goal.score ?? 'No'} ${goal.score === 1 ? 'point' : 'points'}: ${label}`} aria-describedby={hint.describedBy}
      onPointerEnter={event => { if (event.pointerType === 'mouse') hint.show(event.currentTarget) }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') hint.hide() }}
      onFocus={event => hint.show(event.currentTarget)}
      onBlur={hint.hide}
      onPointerDown={() => { openBeforePress.current = hint.anchor !== null }}
      onClick={event => { if (openBeforePress.current) hint.hide(); else hint.show(event.currentTarget); openBeforePress.current = false }}
    >{goal.score ?? '—'}</button>
    {hint.anchor && trigger.current && <ProofCard id={hint.id} goal={goal} trigger={trigger.current} />}
  </>
}
