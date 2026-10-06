import type { Level } from './learningFlow'
export type LearningType = 'theoretical' | 'quantitative' | 'experimental' | 'design'
export type LearningProfile = {
  label: string
  description: string
  criteria: Record<Level, string[]>
  help: Record<Level, string>
  tasks: Partial<Record<Level, string>>
  scenarios: Partial<Record<Level, string>>
}
export const learningTypes: Record<LearningType, LearningProfile>
export const learningTypeIds: LearningType[]
export function resolveLearningType(value?: unknown): LearningType
export function restoreLearningType(value: unknown, started?: boolean): LearningType | null
export function needsScenarioOpening(level: Level, learningType: LearningType): boolean
export function rubricGuidance(learningType?: LearningType): string
