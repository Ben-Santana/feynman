import type { CharacterAppearance } from './characterAppearance'
type Point = [number, number]
// Closed cubic paths keep every coordinate morphable during the burst entrance.
function smoothPath(points: Point[]) {
  const n = points.length
  const at = (i: number) => points[(i + n) % n]
  let path = `M${points[0].join(' ')}`
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1 = p1.map((v, j) => v + (p2[j] - p0[j]) / 6)
    const c2 = p2.map((v, j) => v - (p3[j] - p1[j]) / 6)
    path += `C${[...c1, ...c2, ...p2].map(v => Math.round(v * 1000) / 1000).join(' ')}`
  }
  return path + 'Z'
}
function outline(shape: CharacterAppearance['shape']): Point[] {
  return Array.from({ length: 72 }, (_, i) => {
    const a = i / 72 * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(a), s = Math.sin(a)
    if (shape === 'square' || shape === 'squircle') {
      const power = shape === 'square' ? .32 : .55
      const size = shape === 'square' ? 92 : 96
      return [size * Math.sign(c) * Math.abs(c) ** power, size * Math.sign(s) * Math.abs(s) ** power]
    }
    let r = 98
    if (shape === 'blob') r = 95 + 7 * Math.sin(3 * a + .6) + 5 * Math.cos(2 * a)
    if (shape === 'flower') r = 90 + 10 * Math.cos(6 * (a + Math.PI / 2))
    if (shape === 'star') r = 82 + 18 * Math.cos(5 * (a + Math.PI / 2))
    return [r * c, r * s]
  })
}
const paths = Object.fromEntries(['circle', 'square', 'squircle', 'blob', 'flower', 'star'].map(shape => [shape, smoothPath(outline(shape as CharacterAppearance['shape']))]))
paths.triangle = 'M-17-90C-9-107 9-107 17-90C40-46 64-2 88 42C101 64 90 88 64 88C21 88-21 88-64 88C-90 88-101 64-88 42C-64-2-40-46-17-90Z'
paths.cloud = 'M-94 12C-113-10-105-43-76-48C-78-83-43-107-13-87C7-108 44-99 52-73C91-83 115-49 98-20C119 5 100 42 73 50C44 59-49 59-73 50C-105 44-115 26-94 12Z'
export function characterBodyPath(shape: CharacterAppearance['shape'], original: string) {
  return shape === 'hexagon' ? original : paths[shape]
}
