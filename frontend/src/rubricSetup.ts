import { levelIds, type Concept, type ConceptRubric, type Level } from './learningFlow.ts'
import { checklistItems, checklistText } from './rubricChecklist.js'
import type { SavedSession } from './learningStore'
import { learningTypes, restoreLearningType, type LearningType } from './learningTypes.js'

export function restoreDraft(record: SavedSession<Concept, unknown>) {
  return {
    title: record.title || '',
    step: record.setupStep || 'rubric' as 'title' | 'class-type' | 'concepts' | 'rubric',
    files: Array.isArray(record.files) ? record.files : [],
    selectedTargets: (record.selectedTargets || {}) as Record<string, Level | null>,
    aiByName: record.aiByName ?? true,
    rubricInstructions: record.rubricInstructions || '',
    learningType: restoreLearningType(record.learningType, record.started),
  }
}

export function genericRubric(name: string, target: Level, learningType: LearningType = 'quantitative'): ConceptRubric {
  return Object.fromEntries(levelIds.map((level, index) => [level, index <= levelIds.indexOf(target) ? checklistText(learningTypes[learningType].criteria[level].map(item => item.replace('{topic}', name))) : ''])) as ConceptRubric
}

export function withBasicCriterion(concept: Concept, level: Level, learningType: LearningType = 'quantitative'): Concept {
  if (checklistItems(concept.rubric[level] || '').length) return concept
  return { ...concept, rubric: { ...concept.rubric, [level]: genericRubric(concept.name, level, learningType)[level] } }
}

export function fillMissingRubric(concept: Concept, target: Level, generated: ConceptRubric): Concept {
  const rubric = Object.fromEntries(levelIds.map((level, index) => [level, checklistItems(concept.rubric[level]).length ? concept.rubric[level] : index <= levelIds.indexOf(target) ? generated[level] : ''])) as ConceptRubric
  return { ...concept, name: concept.name.trim(), rubric, target: highestFilledLevel(rubric) ?? target }
}

export function draftTarget(concept: Concept, selected: Level | null | undefined): Level {
  const filled = highestFilledLevel(concept.rubric) ?? 'remember'
  return levelIds[Math.max(levelIds.indexOf(filled), levelIds.indexOf(selected ?? 'remember'))]
}

export function highestFilledLevel(rubric: ConceptRubric): Level | null {
  return levelIds.findLast(level => Boolean(checklistItems(rubric[level] || '').length)) ?? null
}

export function editCriterion(concept: Concept, level: Level, value: string): Concept {
  const rubric = { ...concept.rubric, [level]: value }
  return { ...concept, rubric, target: highestFilledLevel(rubric) ?? 'remember' }
}

export function canStart(concepts: Concept[]): boolean {
  const names = concepts.map(concept => concept.name.trim().toLocaleLowerCase())
  return names.length > 0 && names.every(Boolean) && new Set(names).size === names.length && concepts.every(concept => {
    const target = highestFilledLevel(concept.rubric)
    return target !== null && levelIds.slice(0, levelIds.indexOf(target) + 1).every(level => Boolean(checklistItems(concept.rubric[level] || '').length))
  })
}

export function mergeSuggestions<T extends { name: string }>(existing: T[], names: string[], make: (name: string) => T, limit = 20): T[] {
  const seen = new Set(existing.map(item => item.name.trim().toLocaleLowerCase()).filter(Boolean))
  const merged = existing.filter(item => item.name.trim())
  for (const raw of names) {
    const name = raw.trim()
    const key = name.toLocaleLowerCase()
    if (!name || seen.has(key) || merged.length >= limit) continue
    merged.push(make(name))
    seen.add(key)
  }
  return merged
}
