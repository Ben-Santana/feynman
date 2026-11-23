import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Bloub } from './Bloub'
import { CursorTooltip } from './CursorTooltip'
import { useButtonTooltip } from './useButtonTooltip'
import { normalizeAppearance, type CharacterAppearance } from '../characterAppearance'

type Contributor = { slug: string; href: string; name: string; role: string; detail: string; appearance: CharacterAppearance }
const contributors: Contributor[] = [
  { slug: 'ben', href: 'https://basantana.com', name: 'Benjamin Santana', role: 'Student researcher', detail: 'B.S. candidate in Computer Science', appearance: { name: 'Benjamin', color: 'coral', shape: 'blob', accessories: { glasses: null, face: null, pin: null } } },
  { slug: 'leo', href: 'https://www.linkedin.com/in/leo-shraybman/', name: 'Leo Shraybman', role: 'Student researcher', detail: 'B.S. candidate in Electrical and Computer Engineering', appearance: { name: 'Leo', color: 'sky', shape: 'circle', accessories: { glasses: null, face: 'freckles', pin: null } } },
  { slug: 'koksal', href: 'https://www.wpi.edu/people/faculty/kmus', name: 'Koksal Mus', role: 'Advisor', detail: 'Assistant Professor of Teaching, Electrical and Computer Engineering at WPI. Researches cryptography, cybersecurity, and AI-supported personalized learning.', appearance: { name: 'Koksal', color: 'lavender', shape: 'squircle', accessories: { glasses: 'round', face: null, pin: null } } },
]

export function Contributors() {
  // Each person's own saved classmate; the defaults above show until it loads or if none is saved.
  const [saved, setSaved] = useState<Record<string, CharacterAppearance>>({})
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/contributors', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.avatars) return
        setSaved(Object.fromEntries(Object.entries(data.avatars as Record<string, unknown>).filter(([, value]) => value).map(([slug, value]) => [slug, normalizeAppearance(value)])))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])
  return <section className="home-section home-contributors" aria-labelledby="home-contributors-title">
    <h2 id="home-contributors-title">Contributors</h2>
    <ul>
      {contributors.map(({ slug, href, name, role, detail, appearance }) => <li key={name}>
        <ContributorLink href={href} name={name}><Bloub mode="hero" expression="attentive" appearance={saved[slug] ?? appearance} /></ContributorLink>
        <h3>{name}</h3>
        <p className="contributor-role">{role}</p>
        <p>{detail}</p>
      </li>)}
    </ul>
  </section>
}

function ContributorLink({ href, name, children }: { href: string; name: string; children: ReactNode }) {
  const hint = useButtonTooltip()
  return <>
    <a className="contributor-art" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Learn more about ${name} (opens in a new tab)`}
      onPointerMove={event => { if (event.pointerType === 'mouse') hint.showAt(event.clientX, event.clientY) }}
      onPointerLeave={hint.hide} onClick={hint.hide}>{children}</a>
    {hint.anchor && <CursorTooltip id={hint.id} text="Learn more" anchor={hint.anchor} />}
  </>
}

type Status = { state: 'idle' } | { state: 'sending' } | { state: 'sent' } | { state: 'error'; message: string }
const MESSAGE_LIMIT = 4000

export function ContactSection() {
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (status.state === 'sending') return
    setStatus({ state: 'sending' })
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, message, website }) })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Could not send your message. Please try again.')
      setStatus({ state: 'sent' }); setName(''); setEmail(''); setMessage('')
    } catch (reason) {
      setStatus({ state: 'error', message: reason instanceof Error && reason.message !== 'Failed to fetch' ? reason.message : 'Could not reach Feynman. Check your connection and try again.' })
    }
  }

  const sending = status.state === 'sending'
  return <section className="home-section home-contact" aria-labelledby="home-contact-title">
    <div className="home-contact-intro">
      <h2 id="home-contact-title">Contact us</h2>
      <p>Questions about Feynman or the study? Send us a message and we’ll reply by email.</p>
    </div>
    {status.state === 'sent'
      ? <div className="home-contact-sent" role="status">
        <strong>Message sent</strong>
        <p>We’ll reply to the email address you gave.</p>
        <button type="button" className="home-contact-again" onClick={() => setStatus({ state: 'idle' })}>Send another message</button>
      </div>
      : <form className="home-contact-form" onSubmit={event => void submit(event)}>
        <label htmlFor={`${id}-name`}>Name</label>
        <input id={`${id}-name`} name="name" autoComplete="name" required maxLength={100} value={name} disabled={sending} onChange={event => setName(event.target.value)} />
        <label htmlFor={`${id}-email`}>Email</label>
        <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} disabled={sending} onChange={event => setEmail(event.target.value)} />
        <label htmlFor={`${id}-message`}>Message</label>
        <textarea id={`${id}-message`} name="message" required rows={6} maxLength={MESSAGE_LIMIT} value={message} disabled={sending} onChange={event => setMessage(event.target.value)} aria-describedby={`${id}-count`} />
        <span className="home-contact-count" id={`${id}-count`}>{message.length > MESSAGE_LIMIT * .8 ? `${MESSAGE_LIMIT - message.length} characters left` : ''}</span>
        {/* Hidden from people; automated form fillers tend to complete it. */}
        <div className="home-contact-trap" aria-hidden="true">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} />
        </div>
        {status.state === 'error' && <p className="home-contact-error" role="alert">{status.message}</p>}
        <button className="home-start" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send message'}</button>
      </form>}
  </section>
}
