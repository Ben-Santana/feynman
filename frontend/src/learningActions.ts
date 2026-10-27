export type LearningAction = 'finish'

export function learningActionMessage() {
  return { content: 'Finish my assessment using the evidence I have provided.', finishAssessment: true }
}
