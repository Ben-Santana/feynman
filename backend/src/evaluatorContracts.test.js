import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluationContext, taskDefinition, normalizeAssessment } from './evaluatorContracts.js';
import { compareEvaluators } from './evaluatorComparison.js';

const input = () => ({ level: 'understand', learningType: 'quantitative', topic: 'Capacitors', aspects: ['Explain storage'], messages: [{ id: 'question', role: 'assistant', content: 'How is energy stored?' }, { id: 'answer', role: 'user', content: 'Energy is stored in the electric field between the plates.' }] });
const setup = (request = input()) => { const context = createEvaluationContext(request); return { context, task: taskDefinition(context, 'Explain the storage mechanism.') }; };
const observation = (overrides = {}) => ({ messageId: 'answer', quote: input().messages[1].content, relevance: 'Explains the location of stored energy.', componentIds: ['whole'], assistance: 'none', assistanceMessageIds: [], demonstratesTransfer: false, ...overrides });
const judgment = (criterionId, overrides = {}) => ({ criterionId, status: 'supported', result: 'correct', reasoning: 'valid', opportunity: 'fair', reason: 'Supported by the learner explanation.', abstentionReason: '', independentCheck: 'not_required', transferCheck: 'not_required', observations: [observation()], contradictions: [], ...overrides });
const output = () => ({ reason: 'Evidence checked.', nextEvidenceObjective: '', judgments: [judgment('criterion_1'), judgment('level_task')] });
const checked = (value, request) => { const { context, task } = setup(request); return normalizeAssessment(value, context, task); };

test('contracts preserve supplied IDs, generate repeatable append-stable IDs, and reject duplicates', () => {
  const a = input(); delete a.messages[0].id; delete a.messages[1].id;
  const first = createEvaluationContext(a);
  a.messages.push({ role: 'assistant', content: 'What changes with plate separation?' }, { role: 'user', content: 'The field changes.' });
  assert.deepEqual(createEvaluationContext(a).messages.slice(0, 2).map(m => m.id), first.messages.map(m => m.id));
  a.messages[0].id = 'same'; a.messages[1].id = 'same';
  assert.throws(() => createEvaluationContext(a), /unique/);
  assert.equal(createEvaluationContext(input()).messages[1].id, 'answer');
});

test('strict learner citations reject assistant quotes, wrong IDs, invented and cross-field excerpts', () => {
  for (const o of [observation({ messageId: 'question', quote: 'How is energy stored?' }), observation({ messageId: 'not_present' }), observation({ quote: 'They store chemical energy.' }), observation({ quote: ' ' })]) {
    const value = output(); value.judgments[0].observations = [o];
    const result = checked(value);
    assert.equal(result.judgments[0].status, 'unclear');
    assert.equal(result.judgments[0].observations.length, 0);
    assert.equal(result.completion.eligible, false);
    assert.equal(result.validationIssues[0].code, 'invalid_citation');
  }
  const request = input(); request.messages[1].review = { explanation: 'Additional field' };
  // normalizeAssessment works on original fields; transport paper review validation is separate.
  const { context, task } = setup(); context.messages[1].review = request.messages[1].review;
  const value = output(); value.judgments[0].observations = [observation({ quote: `${request.messages[1].content}\nAdditional field` })];
  assert.equal(normalizeAssessment(value, context, task).completion.eligible, false);
});

test('valid evidence supports required criteria and task without a model completion field', () => {
  const value = output(); value.complete = false;
  const result = checked(value);
  assert.equal(result.completion.eligible, true);
  assert.equal(result.completion.appliedToLearningSession, false);
  assert.equal(result.completion.finalReview, 'shadow_only');
  assert.ok(result.judgments[0].observations[0].id);
});

test('duplicate evidence cannot fabricate component coverage; one quote may support multiple criteria', () => {
  const value = output(); value.judgments[0].observations.push(observation());
  assert.equal(checked(value).judgments[0].observations.length, 1);
  const request = input(); request.evaluatorCriteria = [{ id: 'criterion_1', text: 'Explain storage', required: true, requiresIndependent: false, requiresTransfer: false, components: [{ id: 'whole', text: 'Locate energy' }, { id: 'mechanism', text: 'Explain mechanism' }] }];
  assert.equal(checked(value, request).completion.eligible, false);
  value.judgments[0].observations[0].componentIds.push('mechanism');
  assert.equal(checked(value, request).completion.eligible, true);
});

test('conflicting duplicate assistance cannot be hidden by repeating the same excerpt', () => {
  const value = output(); value.judgments[0].observations.push(observation({ assistance: 'explanation_or_answer', assistanceMessageIds: ['question'] }));
  const result = checked(value);
  assert.equal(result.completion.eligible, false);
  assert.equal(result.validationIssues[0].code, 'conflicting_duplicate_observation');
});

test('legacy optional flags cannot waive rubric criteria or the level task', () => {
  const request = input(); request.evaluatorCriteria = [{ id: 'criterion_1', text: 'Explain storage', required: false, requiresIndependent: false, requiresTransfer: false, components: [{ id: 'whole', text: 'Explain storage' }] }];
  const value = output(); value.judgments[0] = judgment('criterion_1', { status: 'missing', observations: [], opportunity: 'not_yet' });
  assert.equal(checked(value, request).completion.eligible, false);
  assert.equal(checked(value, request).judgments[0].required, true);
  assert.equal(createEvaluationContext(request).criteria[0].required, true);
  value.judgments[0] = judgment('criterion_1');
  assert.equal(checked(value, request).completion.eligible, true);
  value.judgments[1].status = 'missing';
  assert.equal(checked(value, request).completion.eligible, false);
});

test('any unmet rubric criterion blocks a claimed pass, even if its metadata says optional', () => {
  for (const status of ['missing', 'unclear', 'flawed']) {
    const { context, task } = setup();
    context.criteria[0].required = false; // Defense in depth even for a stale internal context.
    const value = output(); value.complete = true;
    value.judgments[0].status = status; value.judgments[0].required = false;
    const result = normalizeAssessment(value, context, task);
    assert.equal(result.completion.eligible, false, status);
    assert.ok(result.completion.blockers.some(b => b.criterionId === 'criterion_1'));
  }
});

test('absence of opportunity, abstention, contradictions, flawed reasoning, and uncertain results block support', () => {
  const variants = [{ opportunity: 'not_yet' }, { opportunity: 'compromised' }, { abstentionReason: 'Image unreadable.' }, { reasoning: 'flawed', result: 'correct' }, { result: 'undetermined' }, { contradictions: [{ messageId: 'answer', quote: 'Energy is stored', reason: 'An unresolved claim under the same conditions.' }] }];
  for (const change of variants) {
    const value = output(); Object.assign(value.judgments[0], change);
    assert.equal(checked(value).completion.eligible, false);
    assert.equal(checked(value).judgments[0].status, 'unclear');
  }
  const value = output(); value.judgments[0].contradictions = [{ messageId: 'question', quote: 'How is energy stored?', reason: 'Assistant is not learner evidence.' }];
  assert.equal(checked(value).validationIssues[0].code, 'invalid_contradiction_citation');
});

test('assisted performance is retained; explicit independence and transfer checks require component evidence', () => {
  const request = input(); request.evaluatorCriteria = [{ id: 'criterion_1', text: 'Explain storage', required: true, requiresIndependent: false, requiresTransfer: false, components: [{ id: 'whole', text: 'Explain storage' }] }];
  const value = output(); value.judgments[0].observations[0] = observation({ assistance: 'explanation_or_answer', assistanceMessageIds: ['question'] });
  assert.equal(checked(value, request).completion.eligible, true);
  request.evaluatorCriteria[0].requiresIndependent = true; value.judgments[0].independentCheck = 'demonstrated';
  assert.equal(checked(value, request).completion.eligible, false);
  value.judgments[0].observations[0].assistance = 'clarification';
  assert.equal(checked(value, request).completion.eligible, true);
  value.judgments[0].observations[0].assistanceMessageIds = ['answer'];
  assert.equal(checked(value, request).completion.eligible, false);
  value.judgments[0].observations[0] = observation(); request.evaluatorCriteria[0].requiresTransfer = true;
  value.judgments[0].transferCheck = 'demonstrated';
  assert.equal(checked(value, request).completion.eligible, false);
  value.judgments[0].observations[0].demonstratesTransfer = true;
  assert.equal(checked(value, request).completion.eligible, true);
});

test('malformed, omitted, duplicate, and unknown criterion/component IDs reject rather than pass', () => {
  for (const change of [value => value.judgments.pop(), value => value.judgments[1].criterionId = 'criterion_1', value => value.judgments[0].observations[0].componentIds = ['invented'], value => value.judgments[0].status = 'pass', value => value.judgments[0].observations[0].relevance = '']) {
    const value = output(); change(value); assert.throws(() => checked(value), /Invalid refined/);
  }
});

test('whiteboard marker must refer to an actual learner image and cannot stand in for invented text', () => {
  const value = output(); value.judgments[0].observations = [observation({ quote: '[Whiteboard image]' })];
  assert.equal(checked(value).completion.eligible, false);
  const { context, task } = setup(); context.messages[1].boardImage = 'image supplied';
  const result = normalizeAssessment(value, context, task);
  assert.equal(result.judgments[0].observations[0].source, 'image');
  assert.equal(result.completion.eligible, true);
});

test('Analyze level task needs learner evidence after paper review', () => {
  const { context, task } = setup(); context.reviewIndex = 1;
  assert.equal(normalizeAssessment(output(), context, task).completion.eligible, false);
  context.messages.push({ id: 'explanation', role: 'user', messageIndex: 3, content: 'I checked each step against energy conservation.' });
  const value = output(); value.judgments[1].observations = [observation({ messageId: 'explanation', quote: context.messages[2].content })];
  assert.equal(normalizeAssessment(value, context, task).completion.eligible, true);
});

const legacyOutput = () => ({ reason: 'Supported.', nextQuestionFocus: '', criteria: [{ aspect: 'Explain storage', status: 'supported', result: 'correct', evidence: [{ messageIndex: 1, quote: input().messages[1].content }] }], task: { status: 'supported', result: 'correct', evidence: [{ messageIndex: 1, quote: input().messages[1].content }] } });
test('the full unnumbered rubric requirement reaches primary and shadow evaluators unchanged', async () => {
  const request = input(); request.criterion = 'Explain storage AND why separating charge requires work.';
  let refinedCalls = 0;
  await compareEvaluators(request, async (instructions, messages, tool) => {
    if (tool.name === 'evaluate_learning') return legacyOutput();
    const material = JSON.parse(messages[0].content[0].text);
    assert.ok(material.definitions.find(d => d.id === 'level_task').text.includes(request.criterion));
    assert.match(instructions, /Every rubric criterion is mandatory/);
    assert.match(instructions, /original rubric text requires more/);
    refinedCalls++;
    return output();
  }, undefined, {}, { shadow: true });
  assert.equal(refinedCalls, 2);
});
test('shadow review is blind and cannot change primary eligibility even on disagreement or failure', async () => {
  for (const fail of [false, true]) {
    const result = await compareEvaluators(input(), async (instructions, messages, tool) => {
      if (tool.name === 'evaluate_learning') return legacyOutput();
      assert.equal(messages[0].content[0].type, 'text');
      const payload = JSON.parse(messages[0].content[0].text);
      assert.equal(payload.assessment, undefined);
      assert.equal(payload.scoringExamples.length, 0);
      if (tool.name === 'review_refined_shadow') {
        assert.match(instructions, /No earlier evaluator labels/);
        if (fail) throw new Error('Reviewer offline');
        const value = output(); value.judgments[0] = judgment('criterion_1', { status: 'unclear', reason: 'Need a causal mechanism.' }); return value;
      }
      return output();
    }, undefined, {}, { shadow: true });
    assert.equal(result.refined.assessment.completion.eligible, true);
    assert.equal(result.legacy.assessment.complete, true);
    assert.equal(result.shadow.status, fail ? 'error' : 'completed');
    if (!fail) assert.equal(result.shadow.wouldBlock, true);
    assert.equal(result.calls.filter(c => c.name === 'respond_to_student').length, 0);
  }
});

test('branch errors stay visible, malformed output retries once, and incomplete primaries skip shadow', async () => {
  let attempts = 0;
  const result = await compareEvaluators(input(), async (_, __, tool) => {
    if (tool.name === 'evaluate_learning') throw new Error('Legacy unavailable');
    attempts++;
    if (attempts === 1) return {};
    const value = output(); value.judgments[0].status = 'unclear'; return value;
  });
  assert.equal(attempts, 2);
  assert.equal(result.legacy.error, 'Legacy unavailable');
  assert.equal(result.refined.assessment.completion.eligible, false);
  assert.equal(result.shadow.status, 'not_run');
});

test('openings and unfinished Quantitative Analyze reviews make no comparison model calls', async () => {
  for (const request of [{ ...input(), messages: [] }, { ...input(), level: 'analyze' }]) {
    const result = await compareEvaluators(request, () => assert.fail('must wait for evidence'));
    assert.ok(result.skipped);
    assert.equal(result.shadow.status, 'not_run');
  }
});
