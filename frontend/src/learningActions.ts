export type LearningAction = 'help' | 'check' | 'finish'

export function learningActionMessage(action: LearningAction) {
  return action === 'help' ? { content: 'I need a prerequisite review for the point I am struggling with.', helpRequest: true }
    : action === 'check' ? { content: 'I am ready to try a new independent check.' }
      : { content: 'Finish my assessment using the evidence I have provided.', finishAssessment: true }
}
