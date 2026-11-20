import { checklistItems } from './rubricChecklist.js'
import { conceptFinished, levelIds, sessionComplete, targetCount, type Concept } from './learningFlow.ts'

// Completion includes goals passed or skipped, rather than measuring mastery.
export function sessionProgress(concepts: Concept[]) {
  let completed = 0
  let total = 0
  for (const concept of concepts) {
    for (const [index, level] of levelIds.slice(0, targetCount(concept.target)).entries()) {
      const items = checklistItems(concept.rubric[level])
      const count = Math.max(items.length, 1)
      total += count
      if (conceptFinished(concept) || index < concept.passed) {
        completed += count
        continue
      }
      if (index !== concept.passed) continue
      const assessment = concept.assessments?.[level] ?? (!concept.assessments ? concept.assessment : null)
      completed += items.filter(item => assessment?.criteria.some(criterion => criterion.aspect.trim() === item && (criterion.status === 'supported' || criterion.skipped))).length
    }
  }
  const percent = total ? sessionComplete(concepts) ? 100 : Math.min(99, Math.round(completed / total * 100)) : 0
  return { completed, total, percent }
}
