import type { ConceptRubric, Level } from './learningFlow.ts'

type RequestedConcept = { name: string; target: Level }
type GeneratedConcept = { name: string; rubric: ConceptRubric }

export async function generateRubricBatches(
  concepts: RequestedConcept[],
  request: (batch: RequestedConcept[], previousRubric: GeneratedConcept[]) => Promise<{ concepts: GeneratedConcept[] }>,
  onProgress?: (completed: number) => void,
): Promise<GeneratedConcept[]> {
  const generated: GeneratedConcept[] = []
  for (let offset = 0; offset < concepts.length; offset += 5) {
    const batch = concepts.slice(offset, offset + 5)
    const result = await request(batch, [...generated])
    if (!Array.isArray(result?.concepts) || result.concepts.length !== batch.length || result.concepts.some((concept, index) => concept.name !== batch[index].name)) {
      throw new Error('Could not generate a complete rubric. Please retry.')
    }
    generated.push(...result.concepts)
    onProgress?.(generated.length)
  }
  return generated
}
