import type { Concept } from './learningFlow'
import type { LearningType } from './learningTypes.js'
import { mergeGuide, missingGuideLevels, type ConceptGuide } from './teachingGuide.js'

type Post = (path: string, body: unknown, signal: AbortSignal) => Promise<unknown>
export type GuideUpdates = Map<string, (concept: Concept) => Concept>
// Matches the server limit; larger batches overflow a single model response.
const batchSize = 2

// Writes the teaching checklists that are missing or out of date for these
// concepts. Each batch is reported as it arrives so a failed batch does not
// hold back the others.
export async function prepareGuides(concepts: Concept[], learningType: LearningType, post: Post, signal: AbortSignal, onPrepared: (updates: GuideUpdates) => void) {
  const pending = concepts.filter(concept => missingGuideLevels(concept).length)
  const batches = Array.from({ length: Math.ceil(pending.length / batchSize) }, (_, index) => pending.slice(index * batchSize, (index + 1) * batchSize))
  const results = await Promise.allSettled(batches.map(async batch => {
    const body = { learningType, concepts: batch.map(concept => ({ name: concept.name, rubric: Object.fromEntries(missingGuideLevels(concept).map(level => [level, concept.rubric[level]])) })) }
    const result = await post('/api/teaching-guide', body, AbortSignal.any([signal, AbortSignal.timeout(150000)])) as { concepts?: { guide?: ConceptGuide }[] }
    if (!Array.isArray(result?.concepts) || result.concepts.length !== batch.length) throw new Error('Could not prepare the teaching checklist.')
    // mergeGuide keeps only checklists that still match the rubric they were written for.
    onPrepared(new Map(batch.map((concept, index) => [concept.id, (current: Concept) => mergeGuide(current, result.concepts![index]?.guide)])))
  }))
  const failed = results.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
}
