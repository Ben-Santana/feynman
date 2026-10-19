import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import attentif from '../assets/bloub-hexagone-attentif-rouge-anime.svg?raw'
import confus from '../assets/bloub-hexagone-confus-rouge-anime.svg?raw'
import excite from '../assets/bloub-hexagone-excite-rouge-anime.svg?raw'
import mefiant from '../assets/bloub-hexagone-mefiant-rouge-anime.svg?raw'
import neutre from '../assets/bloub-hexagone-neutre-rouge-anime.svg?raw'

import { characterColors, characterShapes, defaultAppearance, type CharacterAppearance, type AccessorySlot } from '../characterAppearance'
import { characterBodyPath } from '../characterGeometry'
import { AccessoryArtwork } from './CharacterAccessories'
import { addLook, gazeSmoothing } from '../bloubLook'
import { useMonocleChain } from './useMonocleChain'

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
type BodyGeometry = { path: string; template: string[]; values: number[]; ball: number[] }
function bodyGeometry(shape: CharacterAppearance['shape']): BodyGeometry {
  const path = characterBodyPath(shape, bodyPath)
  const values = parsePathValues(path)
  return { path, template: path.split(pathNumberRe()), values, ball: radialProject(values, 20) }
}

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

function sampleStaticEmotion(emotion: Emotion, facingForward: boolean, appearance: CharacterAppearance): Pose {
  const pose = sampleEmotion(emotion, 0)
  if (!facingForward) return pose
  const [x, y] = faceOffsetFor(appearance.shape)
  return {
    eye0: { ...pose.eye0, matrix: [1, 0, 0, 1, -26 - x, -8 - y] },
    eye1: { ...pose.eye1, matrix: [1, 0, 0, 1, 26 - x, -8 - y] },
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

function applyBody(el: SVGPathElement | null, values: number[], template: string[]) {
  if (!el) return
  el.setAttribute('d', valuesToPath(values, template))
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

function sampleBurst(elapsed: number, restEyes: Pose, body: BodyGeometry) {
  const pop = easeOutBack(clamp01(elapsed / BURST_POP_MS))
  const expand = easeOutCubic(
    clamp01((elapsed - BURST_EXPAND_START) / (BURST_EXPAND_END - BURST_EXPAND_START)),
  )
  const eyes = easeOutCubic(
    clamp01((elapsed - BURST_EYES_START) / (BURST_EXPAND_END - BURST_EYES_START)),
  )
  const bloom = Math.sin(expand * Math.PI) * 0.06

  return {
    body: lerpValues(body.ball, body.values, expand),
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

const LOADING_LOOP_MS = 4800
const loadingLooks = [
  { at: 1200, x: 0, y: 0, tilt: 0 },
  { at: 1540, x: -22, y: -3, tilt: -6 },
  { at: 1840, x: -22, y: -3, tilt: -6 },
  { at: 2260, x: 22, y: -5, tilt: 6 },
  { at: 2580, x: 22, y: -5, tilt: 6 },
  { at: 2920, x: 0, y: -16, tilt: -3 },
  { at: 3200, x: 0, y: 0, tilt: 0 },
] as const

function sampleLoading(elapsed: number, body: BodyGeometry) {
  const time = elapsed % LOADING_LOOP_MS
  const rest = sampleEmotion(emotionsById.attentive, 0)
  // Reuse the chat entrance's particle gathering and ball-to-body morph.
  const entranceTime = BURST_POP_MS + Math.min(time / 1200, 1) * (BURST_DONE_MS - BURST_POP_MS)
  const burst = sampleBurst(entranceTime, rest, body)
  const expand = easeOutCubic(clamp01((entranceTime - BURST_EXPAND_START) / (BURST_EXPAND_END - BURST_EXPAND_START)))
  let y = 74 * (1 - expand)
  let tilt = 0
  let squash = 0
  let shadow = .6 + .4 * expand
  let phase = 'spawn'

  if (time >= 1200) {
    phase = 'look'
    const nextIndex = loadingLooks.findIndex(frame => frame.at >= time)
    const next = loadingLooks[nextIndex < 0 ? loadingLooks.length - 1 : nextIndex]
    const previous = loadingLooks[Math.max(0, nextIndex < 0 ? loadingLooks.length - 1 : nextIndex - 1)]
    const mix = easeInOutCubic(clamp01((time - previous.at) / Math.max(1, next.at - previous.at)))
    const x = lerp(previous.x, next.x, mix)
    const lookY = lerp(previous.y, next.y, mix)
    tilt = lerp(previous.tilt, next.tilt, mix)
    // Blink between glances, then again just before folding away.
    const blink = 1 - .96 * Math.max(
      Math.max(0, 1 - Math.abs(time - 2010) / 90),
      Math.max(0, 1 - Math.abs(time - 3330) / 100),
    )
    for (const eye of [burst.eye0, burst.eye1]) {
      eye.matrix = addLook(eye.matrix, x, lookY)
      eye.matrix[2] *= blink
      eye.matrix[3] *= blink
    }
    y = -Math.sin(clamp01((time - 1200) / 2200) * Math.PI) * 5
    shadow = 1
  }

  if (time >= 3400 && time < 4000) {
    phase = 'collapse'
    const fold = easeInOutCubic((time - 3400) / 600)
    burst.body = lerpValues(body.values, body.ball, fold)
    burst.eye0.matrix = lerpMatrix(burst.eye0.matrix, HIDDEN_EYE, clamp01(fold * 1.8))
    burst.eye1.matrix = lerpMatrix(burst.eye1.matrix, HIDDEN_EYE, clamp01(fold * 1.8))
    const rewind = sampleBurst(1280 - fold * 1000, rest, body)
    burst.particles = rewind.particles.map(particle => ({ ...particle, opacity: particle.opacity * Math.sin(fold * Math.PI) }))
    squash = Math.sin(fold * Math.PI) * .18
    tilt = Math.sin(fold * Math.PI) * 18
    y = 74 * fold
    shadow = 1 - fold * .4
  } else if (time >= 4000) {
    phase = 'bounce'
    const hop = Math.sin((time - 4000) / 800 * Math.PI)
    burst.body = body.ball
    burst.eye0.matrix = HIDDEN_EYE
    burst.eye1.matrix = HIDDEN_EYE
    y = 74 - hop * 42
    squash = -hop * .12
    shadow = .6 - hop * .25
  }

  return {
    ...burst, phase, y, shadow,
    transform: `translate(0 ${y}) rotate(${tilt}) scale(${burst.scale * (1 + squash)} ${burst.scale * (1 - squash)})`,
  }
}

const initialPose = sampleEmotion(emotionsById.neutral, 0)
const heroRestPose = sampleEmotion(emotionsById.attentive, 0)

export type BloubMode = 'default' | 'hero' | 'studio' | 'loading'

function eyeHeight(pose: Pose) {
  return Math.max(...pose.eye0.values.map(Math.abs), ...pose.eye1.values.map(Math.abs))
}
function faceOffsetFor(shape: CharacterAppearance['shape']) {
  return shape === 'triangle' ? [-22, 20] : shape === 'star' ? [-12, 0] : shape === 'cloud' ? [-12, -8] : [0, 0]
}
function fitPose(pose: Pose, appearance: CharacterAppearance): Pose {
  // The triangle narrows above the face: compact the eye pair and keep it
  // in the broad part of the silhouette, including its largest expression.
  if (appearance.shape === 'triangle') {
    const offset = faceOffsetFor(appearance.shape)
    const centerX = (pose.eye0.matrix[4] + pose.eye1.matrix[4]) / 2
    const centerY = (pose.eye0.matrix[5] + pose.eye1.matrix[5]) / 2 + offset[1]
    const desiredX = Math.max(-3, Math.min(3, centerX + offset[0]))
    const minimumY = eyeHeight(pose) > 25 ? 5 : -6
    const desiredY = Math.max(minimumY, Math.min(14, centerY))
    const fit = (eye: Pose['eye0']) => ({ ...eye, matrix: [
      eye.matrix[0] * .8, eye.matrix[1], eye.matrix[2] * .8, eye.matrix[3],
      (eye.matrix[4] - centerX) * .8 + desiredX - offset[0],
      eye.matrix[5] + desiredY - centerY,
    ] as Matrix })
    pose = { eye0: fit(pose.eye0), eye1: fit(pose.eye1) }
  }
  return pose
}

function glassesTransform(left: Matrix, right: Matrix, height = 22, accessory: CharacterAppearance['accessories']['glasses'] = null) {
  // Reserve space around the white eyes, including the tallest expression.
  const paddedEyeScale = (height + 6) / 24
  if (accessory === 'monocle') {
    // Uniform scaling preserves a circular lens regardless of eye spacing.
    return `translate(${right[4]} ${right[5]}) scale(${Math.max(1.05, paddedEyeScale)}) translate(-29 0)`
  }
  const x = (left[4] + right[4]) / 2, y = (left[5] + right[5]) / 2
  const angle = Math.atan2(right[5] - left[5], right[4] - left[4]) * 180 / Math.PI
  const spacing = 58
  const width = Math.hypot(right[4] - left[4], right[5] - left[5]) / spacing
  // Rigid frames keep their silhouette through blinking and expression changes.
  const scale = Math.max(width * 1.16, paddedEyeScale, .92)
  return `translate(${x} ${y}) rotate(${angle}) scale(${scale})`
}
function faceDetailsTransform(pose: Pose, detail: CharacterAppearance['accessories']['face'], shape: CharacterAppearance['shape']) {
  const left = pose.eye0.matrix, right = pose.eye1.matrix
  const x = (left[4] + right[4]) / 2, y = (left[5] + right[5]) / 2
  const offset = Math.max(0, eyeHeight(pose) - 22)
  const width = Math.hypot(right[4] - left[4], right[5] - left[5]) / 52
  const bottom = shape === 'cloud' ? 55 : shape === 'star' ? 64 : 78
  const localBottom = detail === 'moustache' ? 43 : 37
  const anchorY = Math.min(y + offset, bottom - faceOffsetFor(shape)[1] - localBottom)
  return `translate(${x} ${anchorY}) scale(${width} 1)`
}

export function Bloub({ mode = 'default', animateEntrance = mode === 'default', entranceExpression = 'neutral', expression, showControls = true, followPointer = false, appearance = defaultAppearance, static: isStatic = false, facingForward = false, previewSlot }: {
  mode?: BloubMode; animateEntrance?: boolean; entranceExpression?: EmotionId; expression?: EmotionId; showControls?: boolean; followPointer?: boolean
  appearance?: CharacterAppearance; static?: boolean; facingForward?: boolean; previewSlot?: AccessorySlot
}) {
  const isHero = mode === 'hero'
  const isLoading = mode === 'loading'
  const noEntrance = isHero || isLoading || !animateEntrance || isStatic
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const body = useMemo(() => bodyGeometry(appearance.shape), [appearance.shape])
  const bodyRef = useRef(body)
  const shape = characterShapes.find(item => item.id === appearance.shape)!
  const color = characterColors.find(item => item.id === appearance.color)!.hex
  const faceOffset = faceOffsetFor(appearance.shape)
  const appearanceRef = useRef(appearance)
  const faceDetailsRef = useRef<SVGGElement>(null)
  const glassesRef = useRef<SVGGElement>(null)
  const { monocleChainRef, updateMonocleChain } = useMonocleChain()
  const accessoriesRef = useRef<SVGGElement>(null)
  const [emotion, setEmotion] = useState<EmotionId>('neutral')
  const [bursting, setBursting] = useState(!noEntrance && !reducedMotion)
  const displayedEmotion: EmotionId = isHero ? 'attentive' : expression ?? emotion
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const maskId = `bloub-mask-${reactId}`
  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const bodyGroupRef = useRef<SVGGElement>(null)
  const loadingShadowRef = useRef<SVGEllipseElement>(null)
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
  const burstStateRef = useRef<'idle' | 'waiting' | 'playing'>(noEntrance || reducedMotion ? 'idle' : 'waiting')
  const burstStartedAtRef = useRef(0)
  const burstRestPoseRef = useRef(sampleEmotion(emotionsById[entranceExpression], 0))
  const idleStartedAtRef = useRef(0)
  const burstingRef = useRef(!noEntrance && !reducedMotion)

  const staticEmotion = isStatic || reducedMotion ? displayedEmotion : null
  const staticAppearance = isStatic || reducedMotion ? appearance : null

  useEffect(() => {
    if (isStatic) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(media.matches)
      if (media.matches) {
        burstStateRef.current = 'idle'
        burstingRef.current = false
        setBursting(false)
      }
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [isStatic])

  useEffect(() => { appearanceRef.current = appearance }, [appearance])

  useEffect(() => {
    bodyRef.current = body
    if (!burstingRef.current) {
      applyBody(bodyMaskRef.current, body.values, body.template)
      applyBody(bodyFillRef.current, body.values, body.template)
    }
  }, [body])

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
    if (isStatic || reducedMotion || !(isHero || followPointer)) return
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [isStatic, reducedMotion, isHero, followPointer])

  const startBurst = useCallback(() => {
    if (isStatic || reducedMotion) return
    setEmotion(entranceExpression)
    fromPoseRef.current = null
    morphStartedAtRef.current = null
    targetRef.current = entranceExpression
    burstRestPoseRef.current = sampleEmotion(emotionsById[entranceExpression], 0)
    burstStateRef.current = 'playing'
    burstStartedAtRef.current = performance.now()
    burstingRef.current = true
    setBursting(true)
  }, [isStatic, reducedMotion, entranceExpression, setEmotion, setBursting])

  useEffect(() => {
    if (noEntrance || reducedMotion) return
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
  }, [noEntrance, reducedMotion, startBurst])

  useEffect(() => {
    const updateAccessories = (pose: Pose, now: number | null) => {
      const appearance = appearanceRef.current
      glassesRef.current?.setAttribute('transform', glassesTransform(pose.eye0.matrix, pose.eye1.matrix, eyeHeight(pose), appearance.accessories.glasses))
      faceDetailsRef.current?.setAttribute('transform', faceDetailsTransform(pose, appearance.accessories.face, appearance.shape))
      updateMonocleChain(now)
    }
    if (isStatic || reducedMotion) {
      const pose = fitPose(sampleStaticEmotion(emotionsById[staticEmotion ?? 'neutral'], facingForward, appearanceRef.current), appearanceRef.current)
      applyEye(eye0Ref.current, pose.eye0.values, pose.eye0.matrix)
      applyEye(eye1Ref.current, pose.eye1.values, pose.eye1.matrix)
      bodyGroupRef.current?.setAttribute('transform', 'scale(1)')
      updateAccessories(pose, null)
      accessoriesRef.current?.setAttribute('opacity', '1')
      burstStateRef.current = 'idle'
      burstingRef.current = false
      applyBody(bodyMaskRef.current, bodyRef.current.values, bodyRef.current.template)
      applyBody(bodyFillRef.current, bodyRef.current.values, bodyRef.current.template)
      particlesRef.current.forEach(el => el?.setAttribute('opacity', '0'))
      if (modeRef.current === 'loading') svgRef.current?.setAttribute('data-loading-phase', 'still')
      loadingShadowRef.current?.setAttribute('rx', '45')
      return
    }
    let frame = 0
    let previousFrame: number | null = null
    let loadingStartedAt: number | null = null

    const tick = (now: number) => {
      if (modeRef.current === 'loading') {
        loadingStartedAt ??= now
        const pose = sampleLoading(now - loadingStartedAt, bodyRef.current)
        applyBody(bodyMaskRef.current, pose.body, bodyRef.current.template)
        applyBody(bodyFillRef.current, pose.body, bodyRef.current.template)
        applyEye(eye0Ref.current, pose.eye0.values, pose.eye0.matrix)
        applyEye(eye1Ref.current, pose.eye1.values, pose.eye1.matrix)
        bodyGroupRef.current?.setAttribute('transform', pose.transform)
        updateAccessories(pose, now)
        svgRef.current?.setAttribute('data-loading-phase', pose.phase)
        loadingShadowRef.current?.setAttribute('rx', String(45 * pose.shadow))
        pose.particles.forEach((particle, index) => {
          const el = particlesRef.current[index]
          if (!el) return
          el.setAttribute('cx', String(particle.x))
          el.setAttribute('cy', String(particle.y + pose.y))
          el.setAttribute('r', String(particle.r))
          el.setAttribute('opacity', String(particle.opacity))
        })
        frame = requestAnimationFrame(tick)
        return
      }
      const smoothing = gazeSmoothing(previousFrame === null ? 1000 / 60 : now - previousFrame)
      previousFrame = now
      const burstState = burstStateRef.current
      const burstingNow = burstState === 'waiting' || burstState === 'playing'
      const elapsed =
        burstState === 'playing' ? now - burstStartedAtRef.current : 0

      if (burstingNow && modeRef.current !== 'hero') {
        const burst = sampleBurst(elapsed, burstRestPoseRef.current, bodyRef.current)
        applyBody(bodyMaskRef.current, burst.body, bodyRef.current.template)
        applyBody(bodyFillRef.current, burst.body, bodyRef.current.template)
        bodyGroupRef.current?.setAttribute('transform', `scale(${burst.scale})`)
        const burstPose = fitPose({ eye0: burst.eye0, eye1: burst.eye1 }, appearanceRef.current)
        applyEye(eye0Ref.current, burstPose.eye0.values, burstPose.eye0.matrix)
        applyEye(eye1Ref.current, burstPose.eye1.values, burstPose.eye1.matrix)
        accessoriesRef.current?.setAttribute('opacity', String(clamp01((elapsed - BURST_EYES_START) / 400)))
        updateAccessories(burstPose, now)
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
          applyBody(bodyMaskRef.current, bodyRef.current.values, bodyRef.current.template)
          applyBody(bodyFillRef.current, bodyRef.current.values, bodyRef.current.template)
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
        look.x = lerp(look.x, targetLook.x, smoothing)
        look.y = lerp(look.y, targetLook.y, smoothing)
        eye0Matrix = addLook(eye0Matrix, look.x, look.y)
        eye1Matrix = addLook(eye1Matrix, look.x, look.y)
      }

      const fitted = fitPose({ eye0: { ...pose.eye0, matrix: eye0Matrix }, eye1: { ...pose.eye1, matrix: eye1Matrix } }, appearanceRef.current)
      eye0Matrix = fitted.eye0.matrix
      eye1Matrix = fitted.eye1.matrix
      applyEye(eye0Ref.current, pose.eye0.values, eye0Matrix)
      applyEye(eye1Ref.current, pose.eye1.values, eye1Matrix)
      updateAccessories(fitted, now)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isStatic, reducedMotion, staticEmotion, staticAppearance, facingForward, updateMonocleChain])

  const active = emotionsById[displayedEmotion]
  const restPose = fitPose(isStatic || reducedMotion ? sampleStaticEmotion(active, facingForward, appearance) : isHero ? heroRestPose : bursting || isLoading ? {
    eye0: { values: initialPose.eye0.values, matrix: HIDDEN_EYE },
    eye1: { values: initialPose.eye1.values, matrix: HIDDEN_EYE },
  } : initialPose, appearance)
  const restBody = bursting || (isLoading && !isStatic && !reducedMotion) ? valuesToPath(body.ball, body.template) : body.path

  // Keep each category framed consistently, including its “None” option.
  const faceX = (restPose.eye0.matrix[4] + restPose.eye1.matrix[4]) / 2 + faceOffset[0]
  const faceY = (restPose.eye0.matrix[5] + restPose.eye1.matrix[5]) / 2 + faceOffset[1]
  const previewViewBox = previewSlot === 'pin'
    ? `${shape.pin[0] - 46} ${shape.pin[1] - 34} 92 92`
    : previewSlot === 'glasses'
      ? `${faceX - 88} ${faceY - 58} 176 116`
      : previewSlot === 'face'
        ? `${faceX - 76} ${faceY - 36} 152 112`
        : null

  const svg = (
    <svg
      ref={svgRef}
      data-loading-phase={isLoading ? isStatic || reducedMotion ? 'still' : 'spawn' : undefined}
      viewBox={previewViewBox ?? (mode === 'studio' || Object.values(appearance.accessories).some(Boolean) ? '-135 -145 270 290' : '-125 -125 250 250')}
      style={{ '--character': color } as CSSProperties}
      role="img"
      aria-label={bursting ? `${appearance.name} appearing` : `${appearance.name} looking ${active.label.toLowerCase()}`}
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
          <g transform={`translate(${faceOffset.join(" ")})`}><path
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
          /></g>
        </mask>
      </defs>
      {isLoading && <ellipse ref={loadingShadowRef} className="bloub-loading-shadow" cx="0" cy="109" rx="34" ry="5" fill="var(--black)" opacity=".09" />}
      <g ref={bodyGroupRef} transform={bursting && !isHero ? 'scale(0)' : isLoading && !isStatic && !reducedMotion ? 'translate(0 74)' : undefined}>
        <path ref={bodyFillRef} d={restBody} fill="var(--character-eye)" />
        <g mask={`url(#${maskId})`}>
          <rect className="bloub-body-color" x="-158" y="-158" width="316" height="316" fill="var(--character)" />
        </g>
        <g ref={accessoriesRef} opacity={bursting ? 0 : 1}>
          {appearance.accessories.pin && <g transform={`translate(${shape.pin.join(' ')}) scale(.62)`}><g key={appearance.accessories.pin} className="bloub-accessory-enter"><AccessoryArtwork id={appearance.accessories.pin} /></g></g>}
          <g transform={`translate(${faceOffset.join(' ')})`}>
            {appearance.accessories.face && <g ref={faceDetailsRef} transform={faceDetailsTransform(restPose, appearance.accessories.face, appearance.shape)}><g key={appearance.accessories.face} className="bloub-accessory-enter"><AccessoryArtwork id={appearance.accessories.face} /></g></g>}
            <g ref={glassesRef} transform={glassesTransform(restPose.eye0.matrix, restPose.eye1.matrix, eyeHeight(restPose), appearance.accessories.glasses)}>
              {appearance.accessories.glasses && <g key={appearance.accessories.glasses} className="bloub-accessory-enter"><AccessoryArtwork id={appearance.accessories.glasses} monocleChainRef={monocleChainRef} /></g>}
            </g>
          </g>
        </g>
      </g>
      {!isHero && !isStatic &&
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

  if (isStatic) return <div className="bloub-svg bloub-thumbnail">{svg}</div>

  if (isLoading) return <span className="bloub-svg block aspect-square w-full">{svg}</span>

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
        className={`relative aspect-square w-full max-w-[320px] ${bursting || reducedMotion || isLoading ? '' : 'bloub-float'}`}
      >
        <div className="bloub-svg absolute inset-0">{svg}</div>
      </div>

      {showControls && <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={startBurst}
          aria-pressed={bursting}
          disabled={reducedMotion}
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
