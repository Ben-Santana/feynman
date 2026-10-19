export type ChainPoint = { x: number; y: number }
type Particle = ChainPoint & { previousX: number; previousY: number }

export const MONOCLE_CHAIN_ANCHOR = { x: 48, y: 19 }
export const MONOCLE_CHAIN_LENGTH = 26
export const MONOCLE_CHAIN_REST_PATH = `M${MONOCLE_CHAIN_ANCHOR.x} ${MONOCLE_CHAIN_ANCHOR.y}V${MONOCLE_CHAIN_ANCHOR.y + MONOCLE_CHAIN_LENGTH}`

const SEGMENTS = 8
const STEP = 1 / 120
const ITERATIONS = 12
const DAMPING = Math.exp(-3 * STEP)

// A pinned Verlet chain with fixed-length links. Coordinates are in screen
// space so moving or rotating the wearer transfers motion to the free end.
export class MonocleChain {
  readonly points: Particle[]
  private anchor: ChainPoint
  private remainder = 0
  readonly scale: number

  constructor(anchor: ChainPoint, scale = 1) {
    this.anchor = { x: anchor.x, y: anchor.y }
    this.scale = scale
    this.points = Array.from({ length: SEGMENTS + 1 }, (_, index) => {
      const x = anchor.x, y = anchor.y + index * MONOCLE_CHAIN_LENGTH * scale / SEGMENTS
      return { x, y, previousX: x, previousY: y }
    })
  }

  advance(anchor: ChainPoint, elapsed: number) {
    const length = MONOCLE_CHAIN_LENGTH * this.scale / SEGMENTS
    const firstStepAt = STEP - this.remainder
    const steps = Math.floor((this.remainder + elapsed + 1e-9) / STEP)
    for (let step = 0; step < steps; step += 1) {
      const mix = Math.min(1, (firstStepAt + step * STEP) / elapsed)
      const pinned = {
        x: this.anchor.x + (anchor.x - this.anchor.x) * mix,
        y: this.anchor.y + (anchor.y - this.anchor.y) * mix,
      }
      for (let index = 1; index <= SEGMENTS; index += 1) {
        const point = this.points[index]
        const vx = (point.x - point.previousX) * DAMPING
        const vy = (point.y - point.previousY) * DAMPING
        point.previousX = point.x
        point.previousY = point.y
        point.x += vx
        point.y += vy + 550 * this.scale * STEP * STEP
      }
      for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
        Object.assign(this.points[0], pinned)
        for (let index = 0; index < SEGMENTS; index += 1) {
          const a = this.points[index], b = this.points[index + 1]
          const dx = b.x - a.x, dy = b.y - a.y
          const distance = Math.hypot(dx, dy)
          if (distance < 1e-9) continue
          const correction = (distance - length) / distance
          const weight = index === 0 ? 1 : .5
          if (index !== 0) {
            a.x += dx * correction * weight
            a.y += dy * correction * weight
          }
          b.x -= dx * correction * weight
          b.y -= dy * correction * weight
        }
      }
    }
    this.remainder = Math.max(0, this.remainder + elapsed - steps * STEP)
    this.anchor = { x: anchor.x, y: anchor.y }
  }
}

export function chainPath(points: readonly ChainPoint[]) {
  const number = (value: number) => Math.round(value * 1000) / 1000
  const pair = (point: ChainPoint) => `${number(point.x)} ${number(point.y)}`
  let path = `M${pair(points[0])}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index], next = points[index + 1]
    path += `Q${pair(current)} ${pair({ x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 })}`
  }
  return `${path}L${pair(points[points.length - 1])}`
}
