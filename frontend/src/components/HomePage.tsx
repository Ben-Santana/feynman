import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bloub, BloubMark, type EmotionId } from './Bloub'
import { CastDiagram, LevelsDiagram } from './HomeDiagrams'
import { ContactSection, Contributors } from './HomeSections'
import { defaultAppearance, type CharacterAppearance } from '../characterAppearance'
import './HomePage.css'

type Line = { from: 'classmate' | 'you'; text: string; mood?: EmotionId }
const exchange: Line[] = [
  { from: 'classmate', text: 'Why does a ball slow down on the way up?', mood: 'confused' },
  { from: 'you', text: 'Gravity keeps pulling it down, so its upward speed drops.' },
  { from: 'classmate', text: 'So at the very top, gravity is zero?', mood: 'wary' },
  { from: 'you', text: 'No, gravity still pulls. Only the speed is zero for a moment.' },
  { from: 'classmate', text: 'Oh! The speed hits zero, not gravity.', mood: 'excited' },
]

type Chapter = { title: string; body: string; side: 'left' | 'right'; mood: EmotionId }
const chapters: Chapter[] = [
  { title: 'The Feynman method', body: 'If you can explain an idea in plain words, you understand it. Teaching it shows you exactly where you don’t. Your classmate adds Socratic questioning: it asks one question at a time and never hands you the answer.', side: 'left', mood: 'attentive' },
  { title: 'Interactive and engaging', body: 'Name a session, list your concepts, and start explaining. Your classmate reacts to every answer, and you can change its shape, color, and accessories.', side: 'right', mood: 'excited' },
  { title: 'Our research', body: 'Feynman tests how well AI can carry out this method. The goal is to move you past remembering facts toward explaining, applying, and analyzing them.', side: 'left', mood: 'attentive' },
]
const SCENES = chapters.length + 1 // hero, then chapters
const STEP = 1.8 // viewport heights of scrolling per scene
const HOLD = 0.34 // share of each step, on either side of a scene, where it stays fully visible
const FADE = 0.15
const BREATHE = 0.08 // how much the classmate grows at the middle of each scene

const scholar: CharacterAppearance = { ...defaultAppearance, accessories: { glasses: 'round', face: 'freckles', pin: null } }
// The face slot holds one detail, so freckles are swapped for the moustache while both are hidden (scene 2).
const researcher: CharacterAppearance = { ...defaultAppearance, accessories: { glasses: 'round', face: 'moustache', pin: null } }

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const smooth = (t: number) => t * t * (3 - 2 * t)

function useConversation() {
  const [shown, setShown] = useState(() => prefersReducedMotion() ? exchange.length : 0)
  const [typing, setTyping] = useState<Line['from'] | null>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const timers: number[] = []
    let at = 900
    exchange.forEach((line, index) => {
      timers.push(window.setTimeout(() => setTyping(line.from), at))
      at += line.from === 'classmate' ? 1100 : 1500
      timers.push(window.setTimeout(() => { setTyping(null); setShown(index + 1) }, at))
      at += 900 + line.text.length * 22
    })
    return () => timers.forEach(window.clearTimeout)
  }, [])
  const mood = exchange.slice(0, shown).reverse().find(line => line.mood)?.mood ?? 'attentive'
  return { lines: exchange.slice(0, shown), typing, mood: typing === 'you' ? 'attentive' : mood }
}

type Placement = { x: number; y: number; size: number }
/** Where the classmate sits in each scene, in viewport pixels (center point and width). */
function placement(scene: number, width: number, height: number): Placement {
  const compact = width < 760
  if (scene === 0) {
    const size = compact ? Math.min(width * .78, height * .4) : Math.min(height * .86, width * .5, 760)
    return { x: compact ? width * .5 : width * .73, y: height - size * (compact ? .22 : .25), size }
  }
  const textLeft = chapters[scene - 1].side === 'left'
  if (compact) {
    const size = Math.min(width * .4, height * .2)
    return { x: width * (textLeft ? .7 : .3), y: height - size * .66, size }
  }
  const size = Math.min(height * .5, width * .32, 460)
  return { x: width * (textLeft ? .74 : .26), y: height * .55, size }
}

export function HomePage({ onStart }: { onStart: () => void }) {
  const { lines, typing, mood: conversationMood } = useConversation()
  const [scene, setScene] = useState(0)
  const storyRef = useRef<HTMLDivElement>(null)
  const scenesRef = useRef<(HTMLElement | null)[]>([])
  const classmateRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)

  // Always open at the top: the browser restores scroll before this page has its full height.
  useEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    return () => { history.scrollRestoration = previous }
  }, [])

  useEffect(() => {
    let frame = 0, base = 0, current = -1
    const update = () => {
      frame = 0
      const story = storyRef.current, classmate = classmateRef.current
      if (!story || !classmate) return
      const width = window.innerWidth, height = window.innerHeight
      // A hidden or not-yet-laid-out window reports zero size; wait for a real one.
      if (!width || !height) return
      const reduced = prefersReducedMotion()
      const progress = clamp(-story.getBoundingClientRect().top / (height * STEP), 0, SCENES - 1)

      scenesRef.current.forEach((element, index) => {
        if (!element) return
        const distance = progress - index
        const visibility = clamp(1 - (Math.abs(distance) - HOLD) / FADE)
        element.style.opacity = String(visibility)
        element.style.visibility = visibility === 0 ? 'hidden' : 'visible'
        element.style.transform = reduced ? '' : `translate3d(0, ${-distance * 40}px, 0)`
        element.style.filter = reduced || visibility === 1 ? '' : `blur(${(1 - visibility) * 8}px)`
      })

      const from = Math.min(Math.floor(progress), SCENES - 2)
      const travel = reduced ? Math.round(progress - from) : smooth(clamp((progress - from - HOLD) / (1 - HOLD * 2)))
      const a = placement(from, width, height), b = placement(from + 1, width, height)
      const nearest = Math.round(progress)
      // Grow toward the middle of each scene and shrink back toward its edges.
      const breathe = reduced ? 1 : 1 + BREATHE * Math.cos(clamp((progress - nearest) / .5, -1, 1) * Math.PI / 2)
      const x = a.x + (b.x - a.x) * travel, y = a.y + (b.y - a.y) * travel
      const size = (a.size + (b.size - a.size) * travel) * breathe
      const largest = Math.max(...Array.from({ length: SCENES }, (_, index) => placement(index, width, height).size)) * (1 + BREATHE)
      if (largest !== base) { base = largest; classmate.style.width = `${base}px` }
      classmate.style.transform = `translate3d(${x - base / 2}px, ${y - base / 2}px, 0) scale(${size / base})`
      classmate.style.opacity = reduced ? String(clamp(1 - (Math.abs(progress - nearest) - HOLD) / FADE)) : '1'
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress / (SCENES - 1)})`

      if (nearest !== current) { current = nearest; setScene(nearest) }
    }
    const request = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
    }
  }, [])

  const mood = scene === 0 ? conversationMood : chapters[scene - 1].mood
  const sceneRef = (index: number) => (element: HTMLElement | null) => { scenesRef.current[index] = element }
  const visuals: ReactNode[] = [null, <CastDiagram key="cast" active={scene === 2} mounted={scene >= 1} />, <LevelsDiagram key="levels" active={scene === 3} />]

  return <div className="home-page">
    <header className="home-nav">
      <button className="home-nav-brand" type="button" aria-label="Feynman, back to top" onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}>
        <BloubMark className="home-nav-mark" />
      </button>
      <button className="home-start home-start-small" type="button" onClick={onStart}>Start teaching<ArrowIcon /></button>
      <span className="home-nav-progress" aria-hidden="true"><span ref={progressRef} /></span>
    </header>

    <main>
    <h1 className="sr-only">Feynman: learn by teaching an AI classmate</h1>
    <div ref={storyRef} className="home-story" style={{ height: `${((SCENES - 1) * STEP + 1) * 100}svh` }}>
      <div className="home-stage">
        <section ref={sceneRef(0)} className="home-scene home-scene-hero" aria-label="Example conversation">
          <ol className="home-thread">
            {lines.map(line => <li key={line.text} className="home-line" data-from={line.from}>
              <span className="sr-only">{line.from === 'you' ? 'You: ' : 'AI classmate: '}</span>{line.text}
            </li>)}
            {typing && <li className="home-line home-typing" data-from={typing} aria-hidden="true"><i /><i /><i /></li>}
          </ol>
          <svg className="home-scroll-cue" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
        </section>

        {chapters.map(({ title, body, side }, index) => <section key={title} ref={sceneRef(index + 1)} className="home-scene" data-side={side} aria-labelledby={`home-chapter-${index}`}>
          <div className="home-chapter">
            <h2 id={`home-chapter-${index}`}>{title}</h2>
            <p>{body}</p>
            {visuals[index]}
          </div>
        </section>)}

        {/* The scholar accessories stay mounted so they can pop in and out instead of vanishing. */}
        <div ref={classmateRef} className="home-classmate" data-scholar={scene === 1} data-moustache={scene >= 2 ? scene === 3 : undefined}><Bloub mode="hero" expression={mood} appearance={scene >= 2 ? researcher : scholar} /></div>
      </div>
    </div>
    <Contributors />
    <ContactSection />
    </main>
  </div>
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h11m-4.5-5L15 10l-4.5 5" /></svg>
}
