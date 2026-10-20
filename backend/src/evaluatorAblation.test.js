import test from 'node:test';
import assert from 'node:assert/strict';
import { compareEvaluators, combineRefinedReviews } from './evaluatorComparison.js';
import { createEvaluationContext, taskDefinition } from './evaluatorContracts.js';
import { leanAssessmentTool, normalizeLeanAssessment } from './evaluatorLean.js';
import { screenEvaluatorComparison, summarizeEvaluatorComparisons } from './evaluatorBenchmark.js';

const input = () => ({ level: 'understand', topic: 'Storage', aspects: ['Explain field storage'], messages: [{ id: 'q', role: 'assistant', content: 'Explain the storage mechanism.' }, { id: 'u', role: 'user', content: 'Work separating charges stores energy in the electric field.' }] });
const quote = input().messages[1].content;
const legacy = (status = 'supported') => ({ reason: 'Scripted evidence.', nextQuestionFocus: '', criteria: [{ aspect: input().aspects[0], status, result: 'correct', evidence: [{ messageIndex: 1, quote }] }], task: { status, result: 'correct', evidence: [{ messageIndex: 1, quote }] } });
const judgment = (criterionId, status = 'supported') => ({ criterionId, status, result: 'correct', reasoning: 'valid', opportunity: 'fair', reason: 'Scripted evidence.', abstentionReason: '', observations: [{ messageId: 'u', quote }], contradictions: [] });
const lean = (status = 'supported') => ({ reason: 'Scripted evidence.', nextEvidenceObjective: '', judgments: [judgment('criterion_1', status), judgment('level_task')] });
const setup = (request = input()) => { const context = createEvaluationContext(request); return { context, task: taskDefinition(context, 'Explain the mechanism.') }; };

test('default comparison is lean and makes no experimental shadow call', async () => {
  const result = await compareEvaluators(input(), async (_, __, tool) => {
    assert.notEqual(tool.name, 'review_refined_shadow');
    return tool.name === 'evaluate_learning' ? legacy() : lean();
  });
  assert.equal(result.refined.assessment.completion.eligible, true);
  assert.equal(result.refinedSchema, 'lean-v1');
  assert.deepEqual(result.options, { mode: 'comparison', shadow: false });
  assert.equal(result.shadow.reason, 'disabled');
  assert.equal(result.ablation, undefined);
  assert.equal(result.calls.length, 3, 'Two existing assessments plus one lean assessment');
});

test('four-way ablation reuses first passes and records confirmation and review vetoes separately', async () => {
  let existingCalls = 0;
  const result = await compareEvaluators(input(), async (_, messages, tool) => {
    if (tool.name === 'evaluate_learning') return legacy(++existingCalls === 1 ? 'supported' : 'needs_clarification');
    const material = JSON.parse(messages[0].content[0].text);
    assert.equal(material.assessment, undefined);
    return lean(tool.name === 'review_refined_shadow' ? 'unclear' : 'supported');
  }, undefined, {}, { mode: 'ablation' });
  const v = result.ablation.variants;
  assert.equal(result.calls.length, 4, 'No duplicate first-pass calls');
  assert.equal(v.existingFirst.assessment.complete, true);
  assert.equal(v.existingConfirmed.assessment.complete, false);
  assert.equal(v.leanRefined.assessment.completion.eligible, true);
  assert.equal(v.refinedWithShadow.assessment.completion.eligible, false);
  assert.equal(result.refined.assessment.completion.eligible, true, 'Shadow cannot mutate primary');
  assert.equal(result.ablation.appliedToLearningSession, false);
  assert.equal(v.existingConfirmed.confirmationStatus, 'completed');
  assert.ok(v.refinedWithShadow.durationMs >= v.leanRefined.durationMs);
  const fixture = { input: input(), tags: [], expected: { eligible: false, criterionStatuses: [['unclear']] } };
  const screen = screenEvaluatorComparison(fixture, result);
  assert.equal(screen.ablation.existingFirst.falseCompletion, true);
  assert.equal(screen.ablation.refinedWithShadow.eligible, false);
  const summary = summarizeEvaluatorComparisons([screen]);
  assert.equal(summary.ablation.effects.confirmation.correctedFalseCompletions, 1);
  assert.equal(summary.ablation.effects.shadow.correctedFalseCompletions, 1);
  const sufficient = { ...fixture, expected: { eligible: true, criterionStatuses: [['supported']] } };
  const harmful = summarizeEvaluatorComparisons([screenEvaluatorComparison(sufficient, result)]);
  assert.equal(harmful.ablation.effects.confirmation.introducedBlocks, 1);
  assert.equal(harmful.ablation.effects.shadow.introducedBlocks, 1);
});

test('ablation retains first pass on confirmation failure and never labels a failed review a confirmed pass', async () => {
  let count = 0;
  const result = await compareEvaluators(input(), async (_, __, tool) => {
    if (tool.name === 'evaluate_learning') { if (++count === 2) throw new Error('Confirmation offline'); return legacy(); }
    if (tool.name === 'review_refined_shadow') throw new Error('Review offline');
    return lean();
  }, undefined, {}, { mode: 'ablation' });
  const v = result.ablation.variants;
  assert.equal(v.existingFirst.assessment.complete, true);
  assert.equal(v.existingConfirmed.assessment, null);
  assert.equal(v.existingConfirmed.error, 'Confirmation offline');
  assert.equal(v.leanRefined.assessment.completion.eligible, true);
  assert.equal(v.refinedWithShadow.assessment, null);
  assert.equal(v.refinedWithShadow.error, 'Review offline');
});

test('incomplete primaries are not rescued or reviewed even in ablation mode', async () => {
  const result = await compareEvaluators(input(), async (_, __, tool) => {
    assert.notEqual(tool.name, 'review_refined_shadow');
    return tool.name === 'evaluate_learning' ? legacy('missing') : lean('missing');
  }, undefined, {}, { mode: 'ablation' });
  assert.equal(result.calls.length, 2);
  assert.equal(result.ablation.variants.existingConfirmed.confirmationStatus, 'not_needed');
  assert.equal(result.ablation.variants.refinedWithShadow.assessment.completion.eligible, false);
  assert.equal(result.ablation.variants.refinedWithShadow.reviewStatus, 'not_run');
});

test('invalid opt-in values are rejected before model calls', async () => {
  for (const options of [{ shadow: 'true' }, { mode: 'unknown' }, null, []]) {
    await assert.rejects(compareEvaluators(input(), () => assert.fail('No call'), undefined, {}, options), /Choose comparison or ablation/);
  }
});

test('lean output retains citation, reasoning, opportunity, abstention, contradiction and every-item gates', () => {
  const { context, task } = setup();
  assert.equal(normalizeLeanAssessment(lean(), context, task).completion.eligible, true);
  const changes = [j => j.observations[0].messageId = 'q', j => j.observations[0].quote = 'Invented evidence', j => j.reasoning = 'flawed', j => j.result = 'undetermined', j => j.opportunity = 'unknown', j => j.abstentionReason = 'Uncertain domain', j => j.contradictions.push({ messageId: 'u', quote, reason: 'Unresolved material conflict' }), j => j.status = 'missing'];
  for (const change of changes) {
    const value = lean(); value.complete = true; change(value.judgments[0]);
    assert.equal(normalizeLeanAssessment(value, context, task).completion.eligible, false);
  }
  const omitted = lean(); omitted.judgments.pop();
  assert.throws(() => normalizeLeanAssessment(omitted, context, task), /Invalid refined/);
  const malformed = lean(); malformed.judgments[0].observations[0].componentIds = null;
  assert.throws(() => normalizeLeanAssessment(malformed, context, task), /Invalid refined/);
});

test('lean schema requests policy detail only when needed, but cannot invent independent transfer or component coverage', () => {
  const basic = setup();
  const minimal = leanAssessmentTool(basic.context, basic.task, 'evaluate_refined').schema.properties.judgments.items.anyOf[0];
  assert.equal(minimal.properties.independentCheck, undefined);
  assert.deepEqual(Object.keys(minimal.properties.observations.items.properties), ['messageId', 'quote']);
  const request = input(); request.evaluatorCriteria = [{ id: 'criterion_1', text: request.aspects[0], required: false, requiresIndependent: true, requiresTransfer: true, components: [{ id: 'a', text: 'First part' }, { id: 'b', text: 'Second part' }] }];
  const { context, task } = setup(request);
  const schema = leanAssessmentTool(context, task, 'evaluate_refined').schema.properties.judgments.items.anyOf[0];
  assert.ok(schema.required.includes('independentCheck'));
  assert.ok(schema.properties.observations.items.required.includes('componentIds'));
  assert.throws(() => normalizeLeanAssessment(lean(), context, task), /Invalid refined/);
  const value = lean(); const j = value.judgments[0];
  Object.assign(j, { independentCheck: 'demonstrated', transferCheck: 'demonstrated' });
  Object.assign(j.observations[0], { componentIds: ['a', 'b'], assistance: 'none', assistanceMessageIds: [], demonstratesTransfer: true });
  assert.equal(normalizeLeanAssessment(value, context, task).completion.eligible, true);
  j.observations[0].componentIds = ['a'];
  assert.equal(normalizeLeanAssessment(value, context, task).completion.eligible, false);
  j.observations[0].componentIds = ['a', 'b']; j.observations[0].assistance = 'hint'; j.observations[0].assistanceMessageIds = ['q'];
  assert.equal(normalizeLeanAssessment(value, context, task).completion.eligible, false);
});

test('a missing review judgment cannot produce a reviewed pass', () => {
  const { context, task } = setup();
  const primary = normalizeLeanAssessment(lean(), context, task);
  const review = structuredClone(primary); review.judgments.shift(); review.completion.eligible = false;
  const combined = combineRefinedReviews(primary, review, context);
  assert.equal(combined.completion.eligible, false);
  assert.equal(primary.completion.eligible, true);
});
