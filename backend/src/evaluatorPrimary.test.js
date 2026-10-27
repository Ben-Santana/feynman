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

test('task-only transfer policy retains its schema and cannot borrow assisted transfer or original evidence', () => {
  const transferContext = createEvaluationContext({ ...input, level: 'apply' }, { requireTransfer: true });
  const transferTask = taskDefinition(transferContext, 'Apply the concept under a changed condition.');
  const variants = primaryAssessmentTool(transferContext, transferTask).schema.properties.judgments.items.anyOf;
  assert.equal(variants.length, 2, 'ordinary rubric rows share one compact variant');
  const taskSchema = variants.find(v => v.properties.criterionId.enum.includes('level_task'));
  assert.ok(taskSchema.required.includes('transferCheck'));
  const raw = answer();
  const j = raw.judgments.at(-1);
  j.independentCheck = 'demonstrated'; j.transferCheck = 'demonstrated';
  Object.assign(j.observations[0], { assistance: 'none', assistanceMessageIds: [], demonstratesTransfer: false });
  assert.equal(normalizePrimaryAssessment(raw, transferContext, transferTask).completion.eligible, false);
  j.observations[0].demonstratesTransfer = true;
  assert.equal(normalizePrimaryAssessment(raw, transferContext, transferTask).completion.eligible, true);
  j.observations[0].assistance = 'unknown';
  assert.equal(normalizePrimaryAssessment(raw, transferContext, transferTask).completion.eligible, false);
});

test('shared evidence expands before citation validation and never waives policy or accepts dangling references', () => {
  const pooled = answer();
  pooled.evidence = [{ id: 'e1', messageId: 'u', quote: input.messages[1].content }];
  pooled.judgments.forEach(j => { j.observations = [{ evidenceId: 'e1' }]; });
  assert.equal(normalizePrimaryAssessment(pooled, context, task).completion.eligible, true);
  assert.ok(JSON.stringify(pooled).length < JSON.stringify(answer()).length);
  for (const mutate of [r => { r.evidence.push(r.evidence[0]); }, r => { r.judgments[0].observations[0].evidenceId = 'missing'; }, r => { r.evidence.push({ id: 'unused', messageId: 'u', quote: 'Unused' }); }, r => { r.judgments[0].observations[0].quote = 'Override'; }]) {
    const invalid = structuredClone(pooled); mutate(invalid);
    assert.throws(() => normalizePrimaryAssessment(invalid, context, task), /shared evidence/);
  }
  for (const patch of [{ messageId: 'q', quote: input.messages[0].content }, { quote: 'Fabricated quote' }]) {
    const invalid = structuredClone(pooled); Object.assign(invalid.evidence[0], patch);
    assert.equal(normalizePrimaryAssessment(invalid, context, task).completion.eligible, false);
  }
});
