import type { Exercise, PaperGrade } from './PaperReview'

export function rotatePaperDeck(order: number[], direction: -1 | 1): number[] {
  if (order.length < 2) return order
  return direction === 1 ? [...order.slice(1), order[0]] : [order[order.length - 1], ...order.slice(0, -1)]
}

export function collectPaperGrades(exercises: Pick<Exercise, 'id'>[], grades: PaperGrade[], incoming: PaperGrade): PaperGrade[] {
  const byId = new Map(grades.map(grade => [grade.paperId, grade]))
  byId.set(incoming.paperId, incoming)
  return exercises.flatMap(exercise => {
    const grade = byId.get(exercise.id)
    return grade ? [grade] : []
  })
}

export function nextUngradedDeck(order: number[], exercises: Pick<Exercise, 'id'>[], grades: PaperGrade[]): number[] {
  const graded = new Set(grades.map(grade => grade.paperId))
  let next = rotatePaperDeck(order, 1)
  for (let offset = 0; offset < order.length; offset++) {
    if (!graded.has(exercises[next[0]].id)) return next
    next = rotatePaperDeck(next, 1)
  }
  return order
}

export function paperPosition(depth: number): string {
  if (!depth) return 'translate3d(0,0,0) rotateZ(0deg)'
  return `translate3d(${depth % 2 ? -4 : 5}px,${Math.min(depth, 5) * 6}px,${-depth * 3}px) rotateZ(${depth % 2 ? -.65 : .55}deg)`
}
