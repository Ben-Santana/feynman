import { checklistItems, checklistText } from './rubricChecklist.js'
import type { EmotionId } from './components/Bloub'
import type { Paper, Review } from './components/PaperReview'
import type { LearningType } from './learningTypes.js'

export type Level = 'remember' | 'understand' | 'apply' | 'analyze'
export type ConceptRubric = Record<Level, string>
export type Message = { role: 'assistant' | 'user'; content: string; paper?: Paper; review?: Review; boardImage?: string; passedLevel?: Level }
export type Judgment = { status: 'supported' | 'needs_clarification' | 'flawed' | 'missing'; result: 'correct' | 'incorrect' | 'undetermined' | 'not_applicable'; evidence: { messageIndex: number; quote: string }[] }
export type Assessment = { complete: boolean; reason: string; criteria: (Judgment & { aspect: string })[]; task: Judgment }
export type Session = { messages: Message[]; draft: string; assessment: Assessment | null; expression?: EmotionId }
export type Concept = Session & { id: string; name: string; target: Level; rubric: ConceptRubric; assessments?: Partial<Record<Level, Assessment>>; passed: number; stageStart: number; finalSummary?: string; analysisGrade?: number }
export type ChatResult = { message: string; paper?: Paper; assessment: Assessment | null; expression: EmotionId; finalSummary?: string; analysisGrade?: number }

export const levelIds: Level[] = ['remember', 'understand', 'apply', 'analyze']
export const conceptOpening = (name: string): Message => ({ role: 'assistant', content: `Teach me about ${name}.` })
export const startConcepts = (concepts: Concept[]): Concept[] => concepts.map(concept => ({ ...concept, name: concept.name.trim(), rubric: Object.fromEntries(levelIds.map(level => [level, checklistText(checklistItems(concept.rubric[level]))])) as ConceptRubric, passed: 0, stageStart: 0, messages: [conceptOpening(concept.name.trim())], draft: '', assessment: null, assessments: {}, expression: 'attentive' }))
export const targetCount = (level: Level) => levelIds.indexOf(level) + 1
export const sessionComplete = (concepts: Concept[]) => concepts.length > 0 && concepts.every(concept => concept.passed >= targetCount(concept.target))
export const nextPrompt = (level: Level, name: string, learningType: LearningType = 'quantitative') => level === 'understand' ? `Could you explain how or why ${name} works in your own words?` : learningType === 'theoretical' ? `Could you use ${name} to explain a situation and make a prediction with reasoning?` : learningType === 'design' ? `Could you make a design decision using ${name} and justify it against the requirements?` : learningType === 'experimental' ? `Could you use ${name} to predict an outcome and interpret simulated measurements?` : `Could you show me a concrete example of how you would use ${name}, including the steps?`

export const assessmentTranscript = (concept: Concept, learnerMessage: Message, learningType: LearningType) => levelIds[concept.passed] === 'analyze' && learningType === 'quantitative' ? [...concept.messages, learnerMessage] : stageTranscript(concept, learnerMessage)
export const stageTranscript = (concept: Concept, learnerMessage: Message) => [...concept.messages.slice(concept.stageStart), learnerMessage]

export function restoreLearning(saved: { concepts: Concept[]; activeId: string | null; started?: boolean } | null): { concepts: Concept[]; activeId: string | null; started: boolean } | null {
  if (!Array.isArray(saved?.concepts) || !saved.concepts.length) return null
  const concepts = saved.concepts.filter(concept => concept && typeof concept.id === 'string' && typeof concept.name === 'string' && levelIds.includes(concept.target)).map(concept => ({ ...concept, rubric: Object.fromEntries(levelIds.map(level => [level, typeof concept.rubric?.[level] === 'string' ? concept.rubric[level] : ''])) as ConceptRubric, passed: Math.max(0, Math.min(4, Number(concept.passed) || 0)), messages: Array.isArray(concept.messages) ? concept.messages : [], draft: concept.draft || '', stageStart: Number(concept.stageStart) || 0 }))
  if (!concepts.length) return null
  const started = Boolean(saved.started ?? concepts.some(concept => concept.messages.length > 0 || concept.passed > 0))
  const ready = started ? concepts.map(concept => concept.messages.length ? concept : { ...concept, messages: [conceptOpening(concept.name)] }) : concepts
  return { concepts: ready, started, activeId: started ? ready.some(concept => concept.id === saved.activeId) ? saved.activeId : ready[0].id : null }
}

export function advanceConcept(concept: Concept, messages: Message[], result: ChatResult, nextOpening?: { message: string; paper?: Paper }): Concept {
  const passed = concept.passed + (result.assessment?.complete ? 1 : 0)
  const continuing = passed > concept.passed && passed < targetCount(concept.target)
  if (continuing && !nextOpening) throw new Error('The next level needs an opening message.')
  const response = continuing ? nextOpening! : result
  const showResponse = continuing || (!result.finalSummary && passed < targetCount(concept.target))
  return {
    ...concept, passed,
    stageStart: continuing ? messages.length : concept.stageStart,
    messages: showResponse ? [...messages, { role: 'assistant', content: response.message, ...(passed > concept.passed ? { passedLevel: levelIds[concept.passed] } : {}), ...(response.paper ? { paper: response.paper } : {}) }] : messages,
    draft: '', assessment: result.assessment, assessments: { ...concept.assessments, ...(result.assessment ? { [levelIds[concept.passed]]: result.assessment } : {}) }, expression: result.expression,
    ...(result.finalSummary ? { finalSummary: result.finalSummary, analysisGrade: result.analysisGrade } : {}),
  }
}
