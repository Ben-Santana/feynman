import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluationContext, taskDefinition } from './evaluatorContracts.js';
import { leanAssessmentTool } from './evaluatorLean.js';
import { primaryAssessmentTool, normalizePrimaryAssessment, primaryInstructions } from './evaluatorPrimary.js';
import { leanInstructions } from './refinedEvaluator.js';

const input = { level: 'understand', topic: 'Energy', aspects: ['Explain storage', 'Explain charging'], messages: [{ id: 'q', role: 'assistant', content: 'Explain storage and charging.' }, { id: 'u', role: 'user', content: 'Work separating charges stores energy in the field.' }] };
const context = createEvaluationContext(input);
const task = taskDefinition(context, 'Explain the mechanism.');
const answer = () => ({ reason: 'Evidence checked.', nextEvidenceObjective: '', judgments: [...context.criteria, task].map(d => ({ criterionId: d.id, status: 'supported', result: 'correct', reasoning: 'valid', opportunity: 'fair', abstentionReason: '', observations: [{ messageId: 'u', quote: input.messages[1].content }], contradictions: [] })) });

test('simplified primary requests one rationale and a shared schema', () => {
  const tool = primaryAssessmentTool(context, task);
  assert.ok(primaryInstructions.length < leanInstructions.length);
  assert.ok(JSON.stringify(tool).length < JSON.stringify(leanAssessmentTool(context, task, 'evaluate_refined')).length);
  assert.equal(tool.schema.properties.judgments.items.anyOf, undefined);
  assert.equal(tool.schema.properties.judgments.items.properties.reason, undefined);
  assert.equal(normalizePrimaryAssessment(answer(), context, task).completion.eligible, true);
});

test('simplified primary retains every evidence and completion blocker', () => {
  for (const patch of [
    { status: 'missing' }, { reasoning: 'flawed' }, { result: 'incorrect' }, { opportunity: 'compromised' }, { abstentionReason: 'Uncertain interpretation.' },
    { observations: [{ messageId: 'u', quote: 'Invented.' }] }, { observations: [{ messageId: 'q', quote: input.messages[0].content }] },
    { contradictions: [{ messageId: 'u', quote: input.messages[1].content, reason: 'Unresolved claim.' }] },
  ]) {
    const raw = answer(); Object.assign(raw.judgments[0], patch);
    assert.equal(normalizePrimaryAssessment(raw, context, task).completion.eligible, false);
  }
  const raw = answer(); raw.judgments[1].criterionId = 'criterion_1';
  assert.throws(() => normalizePrimaryAssessment(raw, context, task), /Invalid/);
});
