import type { StudentProgress } from './courseStore'
import { conceptFinished, type Concept } from './learningFlow'

export type StudentModuleProgress = StudentProgress['modules'][number]

export function progressStatus(progress?: StudentModuleProgress) {
  if (!progress?.started) return 'Not started'
  const concepts = progress.concepts.map(concept => ({ ...concept, finalSummary: concept.finalSummary ? 'saved' : undefined }) as Concept)
  return concepts.length > 0 && concepts.every(conceptFinished) ? 'Complete' : 'In progress'
}

export const formatScore = (score: number) => `${Math.round(score)}%`

function averageScore(progress: StudentModuleProgress[]) {
  const scores = progress.flatMap(value => value.score === null ? [] : [value.score])
  return scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null
}

function summarize(progress: (StudentModuleProgress | undefined)[]) {
  const complete = progress.filter((value): value is StudentModuleProgress => progressStatus(value) === 'Complete')
  const inProgress = progress.filter(value => progressStatus(value) === 'In progress').length
  return { complete: complete.length, inProgress, notStarted: progress.length - complete.length - inProgress, average: averageScore(complete) }
}

export const topicScoreSummary = (moduleId: string, students: StudentProgress[]) => summarize(students.map(student => student.modules.find(value => value.moduleId === moduleId)))
export const studentScoreSummary = (student: StudentProgress, moduleIds: string[]) => summarize(moduleIds.map(id => student.modules.find(value => value.moduleId === id)))
