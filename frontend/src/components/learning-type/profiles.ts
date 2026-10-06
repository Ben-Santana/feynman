import type { LearningType } from '../../learningTypes.js'
import type { Level } from '../../learningFlow'

// Presentation only: these scores do not influence assessment or rubric generation.
export const classProfiles: Record<LearningType, {
  name: string
  description: string
  emphasis: Record<Level, 1 | 2 | 3 | 4>
}> = {
  theoretical: {
    name: 'Theoretical',
    description: 'Concepts, connections, and the reasoning behind how things work.',
    emphasis: { remember: 4, understand: 4, apply: 2, analyze: 3 },
  },
  quantitative: {
    name: 'Quantitative',
    description: 'Problems, calculations, and the methods behind a solution.',
    emphasis: { remember: 3, understand: 3, apply: 4, analyze: 4 },
  },
  experimental: {
    name: 'Experimental',
    description: 'Predictions, observations, and conclusions grounded in evidence.',
    emphasis: { remember: 2, understand: 3, apply: 4, analyze: 4 },
  },
  design: {
    name: 'Design',
    description: 'Creative decisions, practical constraints, and thoughtful tradeoffs.',
    emphasis: { remember: 1, understand: 3, apply: 4, analyze: 4 },
  },
}

export const emphasisLevels: { id: Level; label: string }[] = [
  { id: 'remember', label: 'Remember' },
  { id: 'understand', label: 'Understand' },
  { id: 'apply', label: 'Apply' },
  { id: 'analyze', label: 'Analyze' },
]
