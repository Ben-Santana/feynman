export type LearningAction = 'finish' | 'skip'

export function learningActionMessage() {
  return { content: 'Finish my assessment using the evidence I have provided.', finishAssessment: true }
}
