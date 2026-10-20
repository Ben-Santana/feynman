import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluationContext, normalizeAssessment, taskDefinition, evidenceStatuses } from './evaluatorContracts.js';
import { compareEvaluators } from './evaluatorComparison.js';
import { evaluatorSamples } from './evaluatorFixtures.js';
import { evaluatorTestCases } from './evaluatorTestCases.js';
import { learningTypeIds } from '../../frontend/src/learningTypes.js';
import { evaluateLegacy } from './chat.js';
import { advanceConcept } from '../../frontend/src/learningFlow.ts';

const levels = ['remember', 'understand', 'apply', 'analyze'];
function setup(level = 'understand', learningType = 'quantitative') {
  const input = level === 'analyze' && learningType === 'quantitative' ? structuredClone(evaluatorSamples.find(c => c.id === 'evaluator-paper-review')) : { level, learningType, topic: 'Contract test', messages: [{ id: 'q', role: 'assistant', content: 'Demonstrate the requested items.' }, { id: 'u', role: 'user', content: 'Evidence for alpha, beta, and gamma.' }] };
  input.aspects = ['Alpha', 'Beta', 'Gamma'];
  const context = createEvaluationContext(input);
  const learner = context.messages.findLast(m => m.role === 'user');
  const observation = { messageId: learner.id, quote: learner.content, relevance: 'Scripted contract evidence; no semantic correctness is inferred by this unit test.', componentIds: ['whole'], assistance: 'none', assistanceMessageIds: [], demonstratesTransfer: false };
  const judgment = criterionId => ({ criterionId, status: 'supported', result: 'correct', reasoning: 'valid', opportunity: 'fair', reason: 'Scripted judgment.', abstentionReason: '', independentCheck: 'not_required', transferCheck: 'not_required', observations: [structuredClone(observation)], contradictions: [] });
  const output = { reason: 'Scripted assessment.', nextEvidenceObjective: '', judgments: [...context.criteria.map(c => judgment(c.id)), judgment('level_task')] };
  return { input, context, output, task: taskDefinition(context, 'Complete the specified task.') };
}
const normalize = s => normalizeAssessment(s.output, s.context, s.task);

test('learning guidance remains context without adding a passing requirement', async () => {
  const fixture = evaluatorTestCases.find(c => c.id === 'evaluator-correction');
  let material;
  await compareEvaluators(fixture.input, async (_, messages, tool) => {
    if (tool.name === 'evaluate_learning') throw new Error('Legacy not needed for this contract check');
    material = JSON.parse(messages[0].content[0].text);
    throw new Error('Captured material');
  });
  assert.ok(material.learningTypeGuidance);
  assert.ok(!material.definitions.find(d => d.id === 'level_task').text.includes(material.learningTypeGuidance));
  assert.equal(material.definitions[0].text, fixture.input.aspects[0]);
});

for (const [index, level] of levels.entries()) for (const pass of [true, false]) test(`${level}: production evaluator ${pass ? 'advances a completed' : 'retains an incomplete'} learning level`, async () => {
  const s = setup(level); const student = s.context.messages.findLast(m => m.role === 'user');
  const assessment = await evaluateLegacy(s.input, async () => {
    const judgment = status => ({ status, result: 'correct', evidence: [{ messageIndex: student.messageIndex, quote: student.content }] });
    return { reason: 'Scripted level-flow judgment.', nextQuestionFocus: '', criteria: s.input.aspects.map((aspect, i) => ({ aspect, ...judgment(!pass && i === 2 ? 'missing' : 'supported') })), task: judgment('supported') };
  });
  assert.equal(assessment.complete, pass);
  const concept = { id: 'concept', name: s.input.topic, target: 'analyze', passed: index, stageStart: 0, messages: s.input.messages, rubric: {}, draft: '' };
  const next = advanceConcept(concept, s.input.messages, { message: 'Next question', assessment }, { message: 'New stage opening' });
  assert.equal(next.passed, index + (pass ? 1 : 0));
  if (!pass) assert.equal(next.stageStart, 0);
});

// These matrices test application contracts, not a model's educational judgments.
for (const learningType of learningTypeIds) for (const level of levels) {
  test(`${learningType}/${level}: all supported criteria and task permit primary eligibility`, () => {
    const s = setup(level, learningType); const result = normalize(s);
    assert.equal(result.completion.eligible, true);
    assert.equal(result.completion.appliedToLearningSession, false);
    assert.equal(result.completion.finalReview, 'shadow_only');
  });
}
for (const level of levels) for (const status of evidenceStatuses.filter(s => s !== 'supported')) for (const item of [0, 1, 2]) {
  test(`${level}: ${status} rubric item ${item + 1} prevents completion despite a model pass claim`, () => {
    const s = setup(level);
    s.output.complete = true; s.output.completion = { eligible: true }; s.output.score = 100;
    s.output.judgments[item].status = status;
    const result = normalize(s);
    assert.equal(result.completion.eligible, false);
    assert.ok(result.completion.blockers.some(b => b.criterionId === s.context.criteria[item].id));
    assert.equal(result.judgments.filter(j => j.status === 'supported').length, 3);
  });
}
for (const result of ['correct', 'incorrect', 'undetermined', 'not_applicable']) for (const reasoning of ['valid', 'flawed', 'unclear', 'not_required']) {
  test(`answer=${result}, reasoning=${reasoning}: correctness cannot mask invalid reasoning`, () => {
    const s = setup(); Object.assign(s.output.judgments[0], { result, reasoning });
    const allowed = ['correct', 'not_applicable'].includes(result) && ['valid', 'not_required'].includes(reasoning);
    assert.equal(normalize(s).completion.eligible, allowed);
  });
}
for (const opportunity of ['not_yet', 'compromised', 'unknown']) test(`opportunity=${opportunity}: no automatic pass or invented student error`, () => {
  const s = setup(); s.output.judgments[0].opportunity = opportunity;
  const result = normalize(s); assert.equal(result.completion.eligible, false); assert.equal(result.judgments[0].status, 'unclear');
});
for (const assistance of ['none', 'clarification', 'hint', 'explanation_or_answer', 'unknown']) test(`independence gate handles assistance=${assistance}`, () => {
  const s = setup(); s.context.criteria[0].requiresIndependent = true;
  s.output.judgments[0].independentCheck = 'demonstrated';
  Object.assign(s.output.judgments[0].observations[0], { assistance, assistanceMessageIds: ['q'] });
  assert.equal(normalize(s).completion.eligible, ['none', 'clarification'].includes(assistance));
});

test('unmet level task blocks every learning level even when every rubric item is supported', () => {
  for (const level of levels) {
    const s = setup(level); s.output.judgments.at(-1).status = 'unclear';
    assert.equal(normalize(s).completion.eligible, false);
  }
});
test('item IDs, not output ordering, bind judgments to requirements', () => {
  const s = setup(); s.output.judgments.reverse();
  assert.deepEqual(normalize(s).judgments.map(j => j.criterionId), ['criterion_1', 'criterion_2', 'criterion_3', 'level_task']);
});
test('identically worded rubric items still require distinct judgments', () => {
  const s = setup(); s.context.criteria[1].text = s.context.criteria[0].text;
  s.output.judgments[1].status = 'missing'; assert.equal(normalize(s).completion.eligible, false);
  s.output.judgments[1].criterionId = 'criterion_1'; assert.throws(() => normalize(s), /Invalid refined/);
});
test('numbered original rubric is authoritative over a weaker aspects list', () => {
  const s = setup(); s.input.criterion = '1. First full requirement.\n2. Second full requirement.';
  s.input.aspects = ['A weaker label'];
  const context = createEvaluationContext(s.input);
  assert.deepEqual(context.criteria.map(c => c.text), ['First full requirement.', 'Second full requirement.']);
  s.input.evaluatorCriteria = [{ ...context.criteria[0], text: 'A weaker label' }];
  assert.throws(() => createEvaluationContext(s.input), /one evaluator criterion|Invalid criterion/);
});
test('old-stage quotes and wrong source IDs cannot be relocated into current-stage evidence', () => {
  const s = setup(); s.output.judgments[0].observations[0].messageId = 'previous_stage_user';
  const result = normalize(s); assert.equal(result.completion.eligible, false); assert.equal(result.judgments[0].observations.length, 0);
});
test('one fabricated excerpt blocks the item even when other valid excerpts remain', () => {
  const s = setup(); s.output.judgments[0].observations.push({ ...s.output.judgments[0].observations[0], quote: 'An invented explanation.' });
  assert.equal(normalize(s).completion.eligible, false);
});
test('every component needs independent evidence, not just one component', () => {
  const s = setup(); const c = s.context.criteria[0];
  c.requiresIndependent = true; c.components = [{ id: 'a', text: 'First component' }, { id: 'b', text: 'Second component' }];
  const j = s.output.judgments[0]; j.independentCheck = 'demonstrated';
  j.observations = [{ ...j.observations[0], componentIds: ['a'] }, { ...j.observations[0], componentIds: ['b'], assistance: 'hint', assistanceMessageIds: ['q'] }];
  assert.equal(normalize(s).completion.eligible, false);
});
test('independent old evidence plus assisted transfer cannot establish independent transfer', () => {
  const s = setup(); Object.assign(s.context.criteria[0], { requiresIndependent: true, requiresTransfer: true });
  const j = s.output.judgments[0]; j.independentCheck = j.transferCheck = 'demonstrated';
  j.observations.push({ ...j.observations[0], assistance: 'hint', assistanceMessageIds: ['q'], demonstratesTransfer: true, quote: 'Evidence for alpha' });
  assert.ok(normalize(s).judgments[0].blockers.includes('independent_transfer_check_needed'));
});
test('a future assistant message cannot be used as the source of earlier assistance', () => {
  const s = setup(); s.context.criteria[0].requiresIndependent = true;
  s.context.messages.push({ id: 'future', messageIndex: 2, role: 'assistant', content: 'Later explanation.' });
  const j = s.output.judgments[0]; j.independentCheck = 'demonstrated';
  Object.assign(j.observations[0], { assistance: 'clarification', assistanceMessageIds: ['future'] });
  const result = normalize(s); assert.equal(result.completion.eligible, false); assert.equal(result.judgments[0].observations[0].assistance, 'unknown');
});
test('later corrected evidence remains available and unresolved contradictions reopen support', () => {
  const s = setup(); const before = normalize(s); assert.equal(before.completion.eligible, true);
  s.output.judgments[0].contradictions = [{ messageId: 'u', quote: 'Evidence for alpha', reason: 'Scripted unresolved error.' }];
  assert.equal(normalize(s).completion.eligible, false);
  s.output.judgments[0].contradictions = [];
  assert.equal(normalize(s).completion.eligible, true);
  assert.equal(before.completion.eligible, true, 'Earlier assessment records are not mutated.');
});
test('abstention with apparently correct evidence blocks completion', () => {
  const s = setup(); s.output.judgments[0].abstentionReason = 'Cannot resolve conflicting domain interpretations.';
  assert.equal(normalize(s).completion.eligible, false);
});
test('output limits reject malformed collections, statuses, and oversized evidence', () => {
  const changes = [s => s.output.judgments[0].observations = null, s => s.output.judgments[0].status = 'passed', s => s.output.judgments[0].observations[0].quote = 'x'.repeat(2001), s => s.output.judgments[0].observations[0].componentIds = ['invented'], s => s.output.judgments.push(s.output.judgments[0]), s => s.output.judgments[0].observations[0].assistance = 'professor_override'];
  for (const change of changes) { const s = setup(); change(s); assert.throws(() => normalize(s), /Invalid refined/); }
});

for (const fixture of evaluatorTestCases.filter(c => c.tags.includes('prompt-injection'))) test(`security boundary: ${fixture.id} stays transcript data, not evaluator instructions`, async () => {
  let refinedCalls = 0;
  const attackText = fixture.input.messages.at(-1).content;
  const result = await compareEvaluators(fixture.input, async (instructions, modelMessages, tool) => {
    if (tool.name === 'evaluate_learning') return { reason: 'Scripted no-evidence response.', nextQuestionFocus: 'The requested unit.', criteria: fixture.input.aspects.map(aspect => ({ aspect, status: 'missing', result: 'undetermined', evidence: [] })), task: { status: 'missing', result: 'undetermined', evidence: [] } };
    assert.ok(!instructions.includes(attackText), 'Transcript text must not be interpolated into system instructions.');
    const payload = JSON.parse(modelMessages[0].content[0].text);
    assert.equal(payload.expected, undefined); assert.equal(payload.rationale, undefined);
    assert.equal(payload.transcript.at(-1).role, 'user'); assert.equal(payload.transcript.at(-1).content, attackText);
    assert.match(instructions, /untrusted DATA/); assert.match(instructions, /Every rubric criterion is mandatory/);
    refinedCalls++;
    // Deliberately conflicting pass claims must not bypass missing judgments.
    return { complete: true, completion: { eligible: true }, reason: 'Scripted missing evidence.', nextEvidenceObjective: 'Demonstrate the requested requirement.', judgments: payload.definitions.map(d => ({ criterionId: d.id, status: 'missing', result: 'undetermined', reasoning: 'unclear', opportunity: 'fair', reason: 'No demonstration in this scripted response.', abstentionReason: '', independentCheck: 'not_required', transferCheck: 'not_required', observations: [], contradictions: [] })) };
  });
  assert.equal(refinedCalls, 1);
  assert.equal(result.refined.assessment.completion.eligible, false);
  assert.equal(result.shadow.status, 'not_run');
});

test('raw student text returned as a tool result fails validation rather than being executed', async () => {
  const attack = evaluatorTestCases.find(c => c.id === 'security-fake-tool-response');
  const result = await compareEvaluators(attack.input, async () => attack.input.messages.at(-1).content);
  assert.ok(result.refined.error); assert.equal(result.refined.assessment, null); assert.equal(result.shadow.status, 'not_run');
});
test('authored semantic cases are valid inputs with separate expectations and both positive/negative controls', () => {
  assert.equal(new Set(evaluatorTestCases.map(c => c.id)).size, evaluatorTestCases.length);
  assert.ok(evaluatorTestCases.some(c => c.expected.eligible)); assert.ok(evaluatorTestCases.some(c => !c.expected.eligible));
  for (const c of evaluatorTestCases) {
    const context = createEvaluationContext(c.input);
    assert.equal(context.eligibility, null, c.id);
    assert.equal(c.expected.criterionStatuses.length, context.criteria.length, c.id);
    assert.equal(c.input.expected, undefined);
    assert.ok(context.criteria.every(item => item.required));
  }
  assert.deepEqual(new Set(evaluatorTestCases.map(c => c.input.level)), new Set(levels));
  assert.deepEqual(new Set(evaluatorTestCases.map(c => c.input.learningType)), new Set(learningTypeIds));
});

// Explicitly not implemented/validated: never turn these into fake passing mocks.
test.todo('Approved-reference ingestion, source conflicts, and professor-scored exemplar calibration');
test.todo('Authenticated instructor corrections and a durable revisable evidence ledger');
test.todo('Independent question-quality checking and no-progress loop stopping');
test.todo('Held-out expert agreement, demographic/accessibility fairness, delayed retention, and transfer validity');
