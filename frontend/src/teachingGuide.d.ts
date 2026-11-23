import type { Concept, Level } from './learningFlow'

export type GuidePrompt = { text: string; criteria: number[] }
export type GuideGroup = { title: string; prompts: GuidePrompt[] }
export type LevelGuide = { source: string; groups: GuideGroup[] }
export type ConceptGuide = Partial<Record<Level, LevelGuide>>
export type GuideState = 'done' | 'corrected' | 'partial' | 'open'
export type GuideChecklist = { level: Level; groups: { title: string; prompts: { text: string; state: GuideState }[] }[]; done: number; total: number; /** The next prompt exists but stays hidden until the student replies. */ waiting: boolean; /** Prompts after the next one, counted but not shown. */ later: number }
type Guided = Pick<Concept, 'rubric' | 'guide'>

export const guideLimits: { groups: number; prompts: number; title: number; text: number }
export function validLevelGuide(guide: unknown, itemCount: number): guide is LevelGuide
export function guideFor(concept: Guided, level: Level): LevelGuide | null
export function missingGuideLevels(concept: Guided & Pick<Concept, 'target'>): Level[]
export function guideLevel(concept: Pick<Concept, 'target' | 'passed'>): Level
export function guideChecklist(concept: Concept, level?: Level): GuideChecklist | null
export function mergeGuide<T extends Guided>(concept: T, generated: ConceptGuide | undefined): T
