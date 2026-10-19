import { useCallback, useRef } from 'react'
import { chainPath, MonocleChain, MONOCLE_CHAIN_ANCHOR, MONOCLE_CHAIN_LENGTH, MONOCLE_CHAIN_REST_PATH } from '../monocleChain'

// Driven by Bloub's existing animation clock; no extra RAF or React renders.
export function useMonocleChain() {
  const pathRef = useRef<SVGPathElement>(null)
  const simulationRef = useRef<{ chain: MonocleChain; time: number; x: number; y: number } | null>(null)

  const update = useCallback((now: number | null) => {
    const path = pathRef.current
    if (!path || now === null) {
      simulationRef.current = null
      path?.setAttribute('d', MONOCLE_CHAIN_REST_PATH)
      return
    }
    const matrix = path.getScreenCTM()
    if (!matrix) return
    const scale = Math.hypot(matrix.c, matrix.d)
    // Entrance animations can briefly collapse the entire character to a point.
    if (scale < .001 || Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-8) {
      simulationRef.current = null
      return
    }
    const anchor = new DOMPoint(MONOCLE_CHAIN_ANCHOR.x, MONOCLE_CHAIN_ANCHOR.y).matrixTransform(matrix)
    let state = simulationRef.current
    const elapsed = state ? (now - state.time) / 1000 : 0
    if (!state || elapsed > .1 || elapsed < 0 || Math.abs(scale / state.chain.scale - 1) > .05
      || Math.hypot(anchor.x - state.x, anchor.y - state.y) > MONOCLE_CHAIN_LENGTH * scale * 3) {
      state = { chain: new MonocleChain(anchor, scale), time: now, x: anchor.x, y: anchor.y }
      simulationRef.current = state
    } else {
      state.chain.advance(anchor, elapsed)
      state.time = now
      state.x = anchor.x
      state.y = anchor.y
    }
    const inverse = matrix.inverse()
    const points = state.chain.points.map(point => new DOMPoint(point.x, point.y).matrixTransform(inverse))
    // The attachment follows the lens exactly, including frames between steps.
    points[0] = new DOMPoint(MONOCLE_CHAIN_ANCHOR.x, MONOCLE_CHAIN_ANCHOR.y)
    path.setAttribute('d', chainPath(points))
  }, [])

  return { monocleChainRef: pathRef, updateMonocleChain: update }
}
