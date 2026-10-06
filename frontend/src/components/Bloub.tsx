import { useEffect, useId, useRef, useState } from 'react'
import attentif from '../assets/bloub-hexagone-attentif-rouge-anime.svg?raw'
import confus from '../assets/bloub-hexagone-confus-rouge-anime.svg?raw'
import excite from '../assets/bloub-hexagone-excite-rouge-anime.svg?raw'
import mefiant from '../assets/bloub-hexagone-mefiant-rouge-anime.svg?raw'
import neutre from '../assets/bloub-hexagone-neutre-rouge-anime.svg?raw'

const MORPH_MS = 520

type Matrix = [number, number, number, number, number, number]
type Frame = { t: number; matrix: Matrix }

type Eye = {
  values: number[]
  frames: Frame[]
}

type Emotion = {
  id: EmotionId
  label: string
  eye0: Eye
  eye1: Eye
}

type Pose = {
  eye0: { values: number[]; matrix: Matrix }
  eye1: { values: number[]; matrix: Matrix }
}

const emotionSources = [
  { id: 'neutral', label: 'Neutral', svg: neutre },
  { id: 'attentive', label: 'Attentive', svg: attentif },
  { id: 'confused', label: 'Confused', svg: confus },
  { id: 'wary', label: 'Wary', svg: mefiant },
  { id: 'excited', label: 'Excited', svg: excite },
] as const

export type EmotionId = (typeof emotionSources)[number]['id']

function pathNumberRe() {
  return /-?\d*\.?\d+(?:e[-+]?\d+)?/gi
}

function parsePathValues(d: string) {
  return [...d.matchAll(pathNumberRe())].map((match) => Number(match[0]))
}

function parseKeyframes(style: string, name: string): Frame[] {
  const block = style.match(
    new RegExp(
      `@keyframes ${name}\\{((?:[\\d.]+%\\{transform:matrix\\([^)]+\\)\\})+)\\}`,
    ),
  )?.[1]

  if (!block) return []

  return [...block.matchAll(/([\d.]+)%\{transform:matrix\(([^)]+)\)\}/g)].map(
    (match) => ({
      t: Number(match[1]) / 100,
      matrix: match[2].split(',').map(Number) as Matrix,
    }),
  )
}

function parseBloubSvg(svg: string) {
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1])
  const style = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const duration = Number(style.match(/animation-duration:([\d.]+)s/)?.[1] ?? 2.967)

  return {
    body: paths[0] ?? '',
    durationMs: duration * 1000,
    eye0: { values: parsePathValues(paths[1] ?? ''), frames: parseKeyframes(style, 'oeil0') },
    eye1: { values: parsePathValues(paths[2] ?? ''), frames: parseKeyframes(style, 'oeil1') },
  }
}

const parsedNeutral = parseBloubSvg(neutre)
const bodyPath = parsedNeutral.body
const idleMs = parsedNeutral.durationMs
const pathTemplate = (neutre.match(/<path d="([^"]+)" class="oeil0"/)?.[1] ?? '').split(
  pathNumberRe(),
)
const bodyTemplate = bodyPath.split(pathNumberRe())
const bodyValues = parsePathValues(bodyPath)
const ballValues = radialProject(bodyValues, 20)

const BURST_POP_MS = 280
const BURST_EXPAND_START = 1080
const BURST_EXPAND_END = 1880
const BURST_EYES_START = 1280
const BURST_DONE_MS = 2000
const HIDDEN_EYE: Matrix = [0.001, 0, 0, 0.001, 0, 0]

const BURST_PARTICLES = [
  { delay: 240, duration: 640, angle: -0.38, dist: 88, radius: 10 },
  { delay: 340, duration: 600, angle: 0.72, dist: 76, radius: 8 },
  { delay: 420, duration: 680, angle: 2.05, dist: 98, radius: 7 },
  { delay: 520, duration: 560, angle: 3.42, dist: 82, radius: 9 },
  { delay: 600, duration: 620, angle: 4.55, dist: 70, radius: 6 },
  { delay: 700, duration: 540, angle: 5.55, dist: 92, radius: 8 },
] as const

const emotions: Emotion[] = emotionSources.map(({ id, label, svg }) => {
  const parsed = parseBloubSvg(svg)
  return { id, label, eye0: parsed.eye0, eye1: parsed.eye1 }
})

const emotionsById = Object.fromEntries(emotions.map((emotion) => [emotion.id, emotion])) as Record<
  EmotionId,
  Emotion
>

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpValues(from: number[], to: number[], t: number) {
  const count = Math.min(from.length, to.length)
  const values = new Array<number>(count)
  for (let i = 0; i < count; i += 1) values[i] = lerp(from[i] ?? 0, to[i] ?? 0, t)
  return values
}

function lerpMatrix(from: Matrix, to: Matrix, t: number): Matrix {
  return [
    lerp(from[0], to[0], t),
    lerp(from[1], to[1], t),
    lerp(from[2], to[2], t),
    lerp(from[3], to[3], t),
    lerp(from[4], to[4], t),
    lerp(from[5], to[5], t),
  ]
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function easeInCubic(t: number) {
  return t * t * t
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function easeOutBack(t: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t))
}

function formatPathNumber(n: number) {
  const rounded = Math.round(n * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function valuesToPath(values: number[], template: string[] = pathTemplate) {
  let path = template[0] ?? ''
  for (let i = 0; i < values.length; i += 1) {
    path += formatPathNumber(values[i] ?? 0) + (template[i + 1] ?? '')
  }
  return path
}

function radialProject(values: number[], radius: number) {
  const projected = values.slice()
  for (let i = 0; i + 1 < projected.length; i += 2) {
    const x = projected[i] ?? 0
    const y = projected[i + 1] ?? 0
    const length = Math.hypot(x, y)
    if (length < 1e-6) continue
    const scale = radius / length
    projected[i] = x * scale
    projected[i + 1] = y * scale
  }
  return projected
}

function matrixTransform(matrix: Matrix) {
  return `matrix(${matrix.join(', ')})`
}

function sampleMatrix(frames: Frame[], t: number): Matrix {
  if (frames.length === 0) return [1, 0, 0, 1, 0, 0]
  if (t <= (frames[0]?.t ?? 0)) return frames[0]?.matrix ?? [1, 0, 0, 1, 0, 0]
  const last = frames[frames.length - 1]
  if (!last || t >= last.t) return last?.matrix ?? [1, 0, 0, 1, 0, 0]

  let index = 1
  while (index < frames.length && (frames[index]?.t ?? 1) < t) index += 1
  const previous = frames[index - 1]
  const next = frames[index]
  if (!previous || !next) return last.matrix
  const span = next.t - previous.t
  const local = span === 0 ? 1 : (t - previous.t) / span
  return lerpMatrix(previous.matrix, next.matrix, local)
}

function idleProgress(now: number, startedAt: number) {
  const elapsed = (now - startedAt) % (idleMs * 2)
  const forward = elapsed / idleMs
  return forward <= 1 ? forward : 2 - forward
}

function sampleEmotion(emotion: Emotion, t: number): Pose {
  return {
    eye0: { values: emotion.eye0.values, matrix: sampleMatrix(emotion.eye0.frames, t) },
    eye1: { values: emotion.eye1.values, matrix: sampleMatrix(emotion.eye1.frames, t) },
  }
}

function lerpPose(from: Pose, to: Pose, t: number): Pose {
  return {
    eye0: {
      values: lerpValues(from.eye0.values, to.eye0.values, t),
      matrix: lerpMatrix(from.eye0.matrix, to.eye0.matrix, t),
    },
    eye1: {
      values: lerpValues(from.eye1.values, to.eye1.values, t),
      matrix: lerpMatrix(from.eye1.matrix, to.eye1.matrix, t),
    },
  }
}

function applyEye(el: SVGPathElement | null, values: number[], matrix: Matrix) {
  if (!el) return
  el.setAttribute('d', valuesToPath(values))
  el.setAttribute('transform', matrixTransform(matrix))
}

function applyBody(el: SVGPathElement | null, values: number[]) {
  if (!el) return
  el.setAttribute('d', valuesToPath(values, bodyTemplate))
}

function addLook(matrix: Matrix, x: number, y: number): Matrix {
  const dist = Math.hypot(x, y)
  const tilt = dist === 0 ? 0 : Math.atan2(y, x) * 0.16 * Math.min(1, dist / 20)
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const [a, b, c, d, e, f] = matrix

  return [
    cos * a - sin * b,
    sin * a + cos * b,
    cos * c - sin * d,
    sin * c + cos * d,
    e + x,
    f + y,
  ]
}

function pointerToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const inv = ctm.inverse()
  return {
    x: inv.a * clientX + inv.c * clientY + inv.e,
    y: inv.b * clientX + inv.d * clientY + inv.f,
  }
}

function lookOffset(
  pointer: { x: number; y: number },
  matrix: Matrix,
  max: number,
) {
  const dx = pointer.x - matrix[4]
  const dy = pointer.y - matrix[5]
  const dist = Math.hypot(dx, dy) || 1
  const amount = max * (1 - Math.exp(-dist / 70))
  return { x: (dx / dist) * amount, y: (dy / dist) * amount }
}

function burstParticlePose(particle: (typeof BURST_PARTICLES)[number], elapsed: number) {
  const local = elapsed - particle.delay
  if (local < 0 || local > particle.duration) {
    return { x: 0, y: 0, r: 0, opacity: 0 }
  }

  const u = local / particle.duration
  const appear = easeOutCubic(clamp01(u / 0.18))
  const travel = easeInCubic(u)
  const dist = particle.dist * (1 - travel)
  const angle = particle.angle + (1 - travel) * 0.45
  const fadeOut = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1

  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    r: particle.radius * (0.3 + 0.7 * (1 - travel)) * appear,
    opacity: appear * fadeOut,
  }
}

function sampleBurst(elapsed: number, restEyes: Pose) {
  const pop = easeOutBack(clamp01(elapsed / BURST_POP_MS))
  const expand = easeOutCubic(
    clamp01((elapsed - BURST_EXPAND_START) / (BURST_EXPAND_END - BURST_EXPAND_START)),
  )
  const eyes = easeOutCubic(
    clamp01((elapsed - BURST_EYES_START) / (BURST_EXPAND_END - BURST_EYES_START)),
  )
  const bloom = Math.sin(expand * Math.PI) * 0.06

  return {
    body: lerpValues(ballValues, bodyValues, expand),
    scale: Math.max(0, pop + bloom),
    eye0: {
      values: restEyes.eye0.values,
      matrix: lerpMatrix(HIDDEN_EYE, restEyes.eye0.matrix, eyes),
    },
    eye1: {
      values: restEyes.eye1.values,
      matrix: lerpMatrix(HIDDEN_EYE, restEyes.eye1.matrix, eyes),
    },
    particles: BURST_PARTICLES.map((particle) => burstParticlePose(particle, elapsed)),
    done: elapsed >= BURST_DONE_MS,
  }
}

const initialPose = sampleEmotion(emotionsById.neutral, 0)
const heroRestPose = sampleEmotion(emotionsById.attentive, 0)

export type BloubMode = 'default' | 'hero'

export function Bloub({ mode = 'default', expression, showControls = true, followPointer = false }: { mode?: BloubMode; expression?: EmotionId; showControls?: boolean; followPointer?: boolean }) {
  const isHero = mode === 'hero'
  const [emotion, setEmotion] = useState<EmotionId>('neutral')
  const [bursting, setBursting] = useState(!isHero)
  const displayedEmotion: EmotionId = isHero ? 'attentive' : expression ?? emotion
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const maskId = `bloub-mask-${reactId}`
  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const bodyGroupRef = useRef<SVGGElement>(null)
  const bodyMaskRef = useRef<SVGPathElement>(null)
  const bodyFillRef = useRef<SVGPathElement>(null)
  const eye0Ref = useRef<SVGPathElement>(null)
  const eye1Ref = useRef<SVGPathElement>(null)
  const particlesRef = useRef<(SVGCircleElement | null)[]>([])
  const targetRef = useRef<EmotionId>(displayedEmotion)
  const fromPoseRef = useRef<Pose | null>(null)
  const morphStartedAtRef = useRef<number | null>(null)
  const lastPoseRef = useRef<Pose>(isHero ? heroRestPose : initialPose)
  const modeRef = useRef(mode)
  const followPointerRef = useRef(followPointer)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const lookRef = useRef({ x: 0, y: 0 })
  const burstStateRef = useRef<'idle' | 'waiting' | 'playing'>(isHero ? 'idle' : 'waiting')
  const burstStartedAtRef = useRef(0)
  const idleStartedAtRef = useRef(0)
  const burstingRef = useRef(!isHero)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    followPointerRef.current = followPointer
  }, [followPointer])

  useEffect(() => {
    if (bursting || targetRef.current === displayedEmotion) return
    fromPoseRef.current = lastPoseRef.current
    morphStartedAtRef.current = performance.now()
    targetRef.current = displayedEmotion
  }, [displayedEmotion, bursting])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  const startBurst = () => {
    setEmotion('neutral')
    fromPoseRef.current = null
    morphStartedAtRef.current = null
    targetRef.current = 'neutral'
    burstStateRef.current = 'playing'
    burstStartedAtRef.current = performance.now()
    burstingRef.current = true
    setBursting(true)
  }

  useEffect(() => {
    if (isHero) return
    const node = rootRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && burstStateRef.current === 'waiting') {
          startBurst()
        }
      },
      { threshold: 0.4 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [isHero])

  useEffect(() => {
    let frame = 0

    const tick = (now: number) => {
      const burstState = burstStateRef.current
      const burstingNow = burstState === 'waiting' || burstState === 'playing'
      const elapsed =
        burstState === 'playing' ? now - burstStartedAtRef.current : 0

      if (burstingNow && modeRef.current !== 'hero') {
        const burst = sampleBurst(elapsed, initialPose)
        applyBody(bodyMaskRef.current, burst.body)
        applyBody(bodyFillRef.current, burst.body)
        bodyGroupRef.current?.setAttribute('transform', `scale(${burst.scale})`)
        applyEye(eye0Ref.current, burst.eye0.values, burst.eye0.matrix)
        applyEye(eye1Ref.current, burst.eye1.values, burst.eye1.matrix)
        burst.particles.forEach((particle, index) => {
          const el = particlesRef.current[index]
          if (!el) return
          el.setAttribute('cx', String(particle.x))
          el.setAttribute('cy', String(particle.y))
          el.setAttribute('r', String(particle.r))
          el.setAttribute('opacity', String(particle.opacity))
        })

        lastPoseRef.current = {
          eye0: burst.eye0,
          eye1: burst.eye1,
        }

        if (burstState === 'playing' && burst.done) {
          burstStateRef.current = 'idle'
          idleStartedAtRef.current = now
          bodyGroupRef.current?.setAttribute('transform', 'scale(1)')
          applyBody(bodyMaskRef.current, bodyValues)
          applyBody(bodyFillRef.current, bodyValues)
          particlesRef.current.forEach((el) => {
            el?.setAttribute('r', '0')
            el?.setAttribute('opacity', '0')
          })
          if (burstingRef.current) {
            burstingRef.current = false
            setBursting(false)
          }
        }

        frame = requestAnimationFrame(tick)
        return
      }

      const target = emotionsById[targetRef.current]
      const toPose = sampleEmotion(target, idleProgress(now, idleStartedAtRef.current))
      const fromPose = fromPoseRef.current
      const morphStartedAt = morphStartedAtRef.current
      let pose = toPose

      if (fromPose && morphStartedAt != null) {
        const mix = Math.min(1, (now - morphStartedAt) / MORPH_MS)
        pose = lerpPose(fromPose, toPose, easeInOutCubic(mix))
        if (mix >= 1) {
          fromPoseRef.current = null
          morphStartedAtRef.current = null
        }
      }

      lastPoseRef.current = pose

      let eye0Matrix = pose.eye0.matrix
      let eye1Matrix = pose.eye1.matrix

      const shouldFollowPointer = modeRef.current === 'hero' || followPointerRef.current
      if (shouldFollowPointer || lookRef.current.x || lookRef.current.y) {
        const svg = svgRef.current
        const pointer = pointerRef.current
        const lookAt =
          shouldFollowPointer && svg && pointer
            ? pointerToSvg(svg, pointer.x, pointer.y)
            : modeRef.current === 'hero' ? { x: 72, y: 4 } : null
        // Move both eyes as one pair. Independent targets let the eyes converge
        // when zooming changes the pointer's position within the SVG.
        const eyeCenter: Matrix = [1, 0, 0, 1,
          (pose.eye0.matrix[4] + pose.eye1.matrix[4]) / 2,
          (pose.eye0.matrix[5] + pose.eye1.matrix[5]) / 2,
        ]
        const targetLook = lookAt ? lookOffset(lookAt, eyeCenter, 22) : { x: 0, y: 0 }
        const look = lookRef.current
        look.x = lerp(look.x, targetLook.x, 0.16)
        look.y = lerp(look.y, targetLook.y, 0.16)
        eye0Matrix = addLook(eye0Matrix, look.x, look.y)
        eye1Matrix = addLook(eye1Matrix, look.x, look.y)
      }

      applyEye(eye0Ref.current, pose.eye0.values, eye0Matrix)
      applyEye(eye1Ref.current, pose.eye1.values, eye1Matrix)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const active = emotionsById[displayedEmotion]
  const restPose = isHero ? heroRestPose : bursting ? {
    eye0: { values: initialPose.eye0.values, matrix: HIDDEN_EYE },
    eye1: { values: initialPose.eye1.values, matrix: HIDDEN_EYE },
  } : initialPose
  const restBody = isHero || !bursting ? bodyPath : valuesToPath(ballValues, bodyTemplate)

  const svg = (
    <svg
      ref={svgRef}
      viewBox="-125 -125 250 250"
      role="img"
      aria-label={bursting ? 'Bloub appearing' : `Bloub looking ${active.label.toLowerCase()}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="-158"
          y="-158"
          width="316"
          height="316"
        >
          <path ref={bodyMaskRef} d={restBody} fill="#fff" />
          <path
            ref={eye0Ref}
            className="bloub-eye"
            d={valuesToPath(restPose.eye0.values)}
            fill="#000"
            transform={matrixTransform(restPose.eye0.matrix)}
          />
          <path
            ref={eye1Ref}
            className="bloub-eye"
            d={valuesToPath(restPose.eye1.values)}
            fill="#000"
            transform={matrixTransform(restPose.eye1.matrix)}
          />
        </mask>
      </defs>
      <g ref={bodyGroupRef} transform={bursting && !isHero ? 'scale(0)' : undefined}>
        <path ref={bodyFillRef} d={restBody} fill="var(--character-eye)" />
        <g mask={`url(#${maskId})`}>
          <rect x="-158" y="-158" width="316" height="316" fill="var(--character)" />
        </g>
      </g>
      {!isHero &&
        BURST_PARTICLES.map((_, index) => (
          <circle
            key={index}
            ref={(el) => {
              particlesRef.current[index] = el
            }}
            cx="0"
            cy="0"
            r="0"
            fill="var(--character)"
            opacity="0"
          />
        ))}
    </svg>
  )

  if (isHero) {
    return (
      <div className="bloub-hero">
        <div className="bloub-float-hero bloub-svg h-full w-full">{svg}</div>
      </div>
    )
  }

  const buttonClass = (activeButton: boolean) =>
    `font-display rounded-full px-4 py-2 text-sm font-medium tracking-wide transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
      activeButton
        ? 'bg-primary text-primary-foreground shadow-primary'
        : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
    }`

  return (
    <div ref={rootRef} className="flex w-full max-w-sm flex-col items-center">
      <div
        className={`relative aspect-square w-full max-w-[320px] ${bursting ? '' : 'bloub-float'}`}
      >
        <div className="bloub-svg absolute inset-0">{svg}</div>
      </div>

      {showControls && <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={startBurst}
          aria-pressed={bursting}
          className={buttonClass(bursting)}
        >
          Burst
        </button>
        {emotions.map(({ id, label }) => {
          const isActive = !bursting && id === emotion

          return (
            <button
              key={id}
              type="button"
              onClick={() => setEmotion(id)}
              aria-pressed={isActive}
              disabled={bursting}
              className={buttonClass(isActive)}
            >
              {label}
            </button>
          )
        })}
      </div>}
    </div>
  )
}
