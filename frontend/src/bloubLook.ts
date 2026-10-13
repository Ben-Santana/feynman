export type EyeMatrix = [number, number, number, number, number, number]

export function addLook(matrix: EyeMatrix, x: number, y: number): EyeMatrix {
  // A continuous vertical tilt avoids atan2's jump across the negative x axis.
  // The soft center also keeps tiny movements near the face from changing angle sharply.
  const tilt = 0.25 * y / Math.hypot(x, y, 8)
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

export function gazeSmoothing(elapsedMs: number) {
  // Exponential damping has the same response at different refresh rates.
  // Limit the catch-up step when a background tab resumes.
  return -Math.expm1(-Math.max(0, Math.min(elapsedMs, 64)) / 96)
}
