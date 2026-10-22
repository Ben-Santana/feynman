// Reuse the validated rubric assessment. These are assessment gaps and local
// error hypotheses, not a second model's diagnosis or claims about stable beliefs.
export function learnerStateFromAssessment(input, assessment) {
  const criteria = assessment?.criteria ?? [];
  const judgments = [...criteria, ...(assessment?.task ? [{ ...assessment.task, aspect: 'Overall level task' }] : [])];
  const evidence = [];
  for (const judgment of judgments) for (const citation of judgment.evidence ?? []) {
    const message = input.messages[citation.messageIndex];
    const fields = [message?.content, message?.review?.explanation].filter(value => typeof value === 'string');
    if (message?.role !== 'user' || typeof citation.quote !== 'string' || !citation.quote.trim()) continue;
    if (!fields.some(value => value.includes(citation.quote)) && !(citation.quote === '[Whiteboard image]' && message.boardImage)) continue;
    if (!evidence.some(e => e.messageIndex === citation.messageIndex && e.quote === citation.quote)) evidence.push({ messageIndex: citation.messageIndex, quote: citation.quote });
  }
  const refined = assessment?.refined;
  const uncertain = judgments.filter(j => ['needs_clarification', 'unclear'].includes(j.status)).map(j => `Evidence remains unclear for: ${j.aspect}`);
  const abstentions = (refined?.judgments ?? []).filter(j => j.abstentionReason?.trim()).map(j => `${j.criterionId}: ${j.abstentionReason}`);
  const target = judgments.find(j => j.status !== 'supported');
  return {
    understands: criteria.filter(j => j.status === 'supported').map(j => j.aspect),
    potentialMisconceptions: criteria.filter(j => j.status === 'flawed').map(j => `Investigate the assessed error in ${j.aspect}; this is not evidence of a stable misconception.`),
    missingConcepts: criteria.filter(j => j.status === 'missing').map(j => `Not yet demonstrated: ${j.aspect}`),
    uncertainty: [...uncertain, ...abstentions, ...(!evidence.length ? ['No verified learner quotation is available; do not infer understanding or beliefs from missing evidence.'] : [])],
    diagnosticObjective: assessment?.nextQuestionFocus?.trim() || refined?.nextEvidenceObjective?.trim() || (target ? `Elicit evidence for: ${target.aspect}` : 'Clarify the remaining level-task evidence.'),
    evidence,
  };
}
