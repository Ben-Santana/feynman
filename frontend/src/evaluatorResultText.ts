const labels: Record<string, string> = {
  supported: 'Demonstrated', missing: 'Not demonstrated yet', unclear: 'Needs clarification', needs_clarification: 'Needs clarification', flawed: 'Error identified',
  correct: 'Correct', incorrect: 'Incorrect', undetermined: 'Not yet clear', not_applicable: 'Not applicable',
  valid: 'Sound reasoning', not_required: 'Not required for this task',
  fair: 'A fair chance to demonstrate this', compromised: 'The question did not provide a fair assessment', not_yet: 'Not assessed yet', unknown: 'Not enough information',
  none: 'Without substantive help', clarification: 'After clarification', hint: 'After a hint', explanation_or_answer: 'After an explanation or supplied answer',
  no_valid_evidence: 'No verified student evidence was cited.', uncovered_components: 'Part of this requirement still needs evidence.', no_fair_opportunity: 'A clearer or fairer question is needed.',
  result_not_supported: 'The answer is incorrect or not yet clear.', reasoning_not_supported: 'The reasoning contains an error or needs clarification.', unresolved_contradiction: 'Conflicting student statements still need to be resolved.',
  abstention: 'The evaluator cannot make a reliable judgment yet.', invalid_evidence: 'Some cited evidence could not be verified.',
  independent_check_needed: 'A fresh demonstration without substantive help is needed.', transfer_check_needed: 'Evidence in a new situation is needed.', independent_transfer_check_needed: 'The new situation needs to be handled without substantive help.',
  post_review_explanation_needed: 'The student needs to explain their paper review.', no_learner_evidence: 'No student answer is available to assess.', awaiting_paper_review_explanation: 'Waiting for the paper review and the student’s explanation.',
  invalid_citation: 'A quote did not match the cited student message.', invalid_contradiction_citation: 'A cited contradiction could not be verified in the student’s messages.',
  invalid_assistance_source: 'The source of assistance could not be verified.', conflicting_duplicate_observation: 'The same evidence received conflicting descriptions.',
  missing_judgment: 'This requirement was not assessed.',
}
export function evaluatorLabel(value: string): string {
  if (labels[value]) return labels[value]
  if (value.startsWith('status_')) return `${evaluatorLabel(value.slice(7))}.`
  return value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())
}

export function comparisonHeadline(legacyComplete: boolean | undefined, refinedEligible: boolean | undefined): string {
  if (legacyComplete === undefined || refinedEligible === undefined) return 'The comparison is incomplete'
  if (legacyComplete && refinedEligible) return 'Both evaluators would finish this stage'
  if (!legacyComplete && !refinedEligible) return 'Both evaluators need more evidence'
  return legacyComplete ? 'Only the existing evaluator would finish' : 'Only the refined evaluator would finish'
}

// Preserve archived evidence, but never display a pass that bypassed a rubric item.
export function refinedEligibilityForDisplay(assessment: { completion: { eligible: boolean }; judgments: { criterionId: string; status: string; blockers: string[] }[] } | null, definitions: { id: string }[]): boolean | undefined {
  if (!assessment) return undefined
  return assessment.completion.eligible && definitions.length > 0 && [...definitions, { id: 'level_task' }].every(d => assessment.judgments.some(j => j.criterionId === d.id && j.status === 'supported' && !j.blockers.length))
}
