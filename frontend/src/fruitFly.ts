// A deliberately tiny, entirely local joke. Never send this ID to an AI provider.
export const FRUIT_FLY_MODEL = 'fruit-fly-brain'
export const FRUIT_FLY_UNLOCK_KEY = 'feynman-fruit-fly-unlocked'
const fruits = ['banana', 'mango', 'peach', 'pear', 'strawberry', 'pineapple', 'watermelon', 'cherry']
const levels = ['remember', 'understand', 'apply', 'analyze']

export function fruitFlyBuzz(random = Math.random): string {
  return `Bzz Bzz ${fruits[Math.floor(random() * fruits.length)]} bzz bzzzz`
}

export function fruitFlyRubric(target = 'analyze') {
  return Object.fromEntries(levels.map((level, index) => [level, index <= levels.indexOf(target) ? fruitFlyBuzz() : '']))
}

export function fruitFlyResponse(path: string, body: unknown): unknown {
  const input = body as { concepts?: { name: string; target: string }[]; level?: string }
  if (path === '/api/chat') return { message: fruitFlyBuzz(), assessment: null, expression: 'excited', calls: [] }
  if (path === '/api/rubric') return { concepts: input.concepts?.map(concept => ({ name: concept.name, rubric: fruitFlyRubric(concept.target) })) }
  if (path === '/api/developer/rubric') return { items: [fruitFlyBuzz()] }
  if (path === '/api/concept-suggestions') return { names: [fruitFlyBuzz()] }
  return undefined
}

// Only distinct taps count; holding Space should not accidentally discover it.
export function spaceTapStreak(previous: number[], now: number, repeat: boolean): number[] {
  return repeat ? previous : [...previous.filter(time => now - time <= 2400), now].slice(-8)
}
