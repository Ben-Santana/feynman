export type LearningAction = 'check' | 'finish'

export function learningActionMessage(action: LearningAction) {
  return action === 'check' ? { content: 'I am ready to try a new independent check.' }
      : { content: 'Finish my assessment using the evidence I have provided.', finishAssessment: true }
}
