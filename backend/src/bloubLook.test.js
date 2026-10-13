import test from 'node:test'
import assert from 'node:assert/strict'
import { addLook, gazeSmoothing } from '../../frontend/src/bloubLook.ts'

const identity = [1, 0, 0, 1, 0, 0]
const tiltAt = (x, y) => {
  const matrix = addLook(identity, x, y)
  return Math.atan2(matrix[1], matrix[0])
}

test('gaze crosses the left side of the face without an angle snap', () => {
  for (const x of [-22, -10, -1, 0, 1, 22]) {
    assert.ok(Math.abs(tiltAt(x, 0.001) - tiltAt(x, -0.001)) < 0.0001)
  }
})

test('close vertical pointer sweeps have continuous bounded tilt', () => {
  for (const x of [-22, -1, 0, 1, 22]) {
    let previous = tiltAt(x, -22)
    for (let y = -21.9; y <= 22; y += 0.1) {
      const tilt = tiltAt(x, y)
      assert.ok(Math.abs(tilt) <= 0.25)
      assert.ok(Math.abs(tilt - previous) < 0.004)
      previous = tilt
    }
  }
  assert.deepEqual(addLook(identity, 0, 0), identity)
})

test('gaze smoothing responds equally at 60Hz and 120Hz', () => {
  const simulate = (hz) => {
    let x = 0
    for (let frame = 0; frame < hz / 2; frame++) {
      x += (22 - x) * gazeSmoothing(1000 / hz)
    }
    return x
  }
  assert.ok(Math.abs(simulate(60) - simulate(120)) < 1e-10)
})

test('gaze smoothing never overshoots or jumps after a paused tab', () => {
  assert.equal(gazeSmoothing(0), 0)
  assert.equal(gazeSmoothing(-1), 0)
  assert.ok(gazeSmoothing(10000) < 0.5)
})
