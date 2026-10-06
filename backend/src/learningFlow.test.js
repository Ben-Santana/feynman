import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceConcept, restoreLearning, sessionComplete, stageTranscript, startConcepts, targetCount } from '../../frontend/src/learningFlow.ts';
import { canStart, editCriterion, genericRubric, highestFilledLevel, mergeSuggestions, restoreDraft, withBasicCriterion } from '../../frontend/src/rubricSetup.ts';

const rubric = { remember: 'Mention A and B.', understand: 'Explain why.', apply: 'Show an example.', analyze: 'Check a solution.' };
const concept = (id, target = 'analyze') => ({ id, name: id, rubric, target, passed: 0, stageStart: 0, messages: [], draft: '', assessment: null });
const assessment = complete => ({ complete, reason: '', criteria: [], task: {} });

test('starting creates one independent Remember chat per concept', () => {
  const original = [concept('integrals'), concept('derivatives')];
  const started = startConcepts(original);
  assert.deepEqual(started.map(item => item.messages), [
    [{ role: 'assistant', content: 'Teach me about integrals.' }],
    [{ role: 'assistant', content: 'Teach me about derivatives.' }],
  ]);
  assert.deepEqual(started.map(item => item.passed), [0, 0]);
  assert.equal(original[0].messages.length, 0);
});

test('generic setup fills only targeted levels and starting preserves the chosen target', () => {
  const custom = { ...concept('integrals', 'understand'), rubric: genericRubric('integrals', 'understand') };
  assert.ok(custom.rubric.remember);
  assert.ok(custom.rubric.understand);
  assert.equal(custom.rubric.apply, '');
  assert.equal(custom.rubric.analyze, '');
  assert.equal(canStart([custom]), true);
  const started = startConcepts([custom])[0];
  assert.equal(started.target, 'understand');
  assert.equal(targetCount(started.target), 2);
});

test('editing the rubric raises and lowers the outlined target', () => {
  let current = { ...concept('integrals', 'understand'), rubric: genericRubric('integrals', 'understand') };
  current = editCriterion(current, 'analyze', 'Check a solution.');
  assert.equal(current.target, 'analyze');
  assert.equal(canStart([current]), false);
  current = editCriterion(current, 'apply', 'Show an example.');
  assert.equal(canStart([current]), true);
  current = editCriterion(current, 'analyze', '');
  assert.equal(current.target, 'apply');
  current = editCriterion(current, 'apply', '');
  assert.equal(current.target, 'understand');
  current = editCriterion(current, 'understand', '');
  current = editCriterion(current, 'remember', '');
  assert.equal(highestFilledLevel(current.rubric), null);
  assert.equal(canStart([current]), false);
});

test('continuing fills a blank next-level criterion with the basic template and preserves custom criteria', () => {
  const current = { ...concept('integrals', 'remember'), rubric: { remember: 'Name the integral symbol.', understand: '  ', apply: '', analyze: '' } };
  const continued = withBasicCriterion(current, 'understand');
  assert.equal(continued.rubric.understand, genericRubric('integrals', 'understand').understand);
  assert.equal(continued.rubric.remember, current.rubric.remember);
  assert.equal(current.rubric.understand, '  ');
  const custom = { ...continued, rubric: { ...continued.rubric, apply: 'Solve an area problem.' } };
  assert.equal(withBasicCriterion(custom, 'apply'), custom);
});

test('suggestions append distinct concepts and draft setup can be restored', () => {
  const manual = { ...concept('integrals'), name: 'Integrals' };
  const merged = mergeSuggestions([manual, { ...concept('blank'), name: '' }], [' integrals ', 'Derivatives', 'derivatives'], name => ({ ...concept(name), name }));
  assert.deepEqual(merged.map(item => item.name), ['Integrals', 'Derivatives']);
  assert.equal(merged[0], manual);
  const file = { name: 'notes.txt', size: 12 };
  const draft = restoreDraft({ id: 'one', title: 'Calculus', updatedAt: 1, started: false, concepts: [manual], activeId: null, setupStep: 'concepts', files: [file], selectedTargets: { [manual.id]: 'apply' }, aiByName: true });
  assert.equal(draft.step, 'concepts');
  assert.equal(draft.title, 'Calculus');
  assert.deepEqual(draft.files, [file]);
  assert.equal(draft.selectedTargets[manual.id], 'apply');
});

test('each stage assesses only its own new messages and advances one level', () => {
  const remembered = startConcepts([concept('integrals')])[0];
  const learner = { role: 'user', content: 'An integral accumulates change.' };
  assert.deepEqual(stageTranscript(remembered, learner), [remembered.messages[0], learner]);
  const understood = advanceConcept(remembered, [...remembered.messages, learner], { message: 'Thank you!', expression: 'excited', assessment: assessment(true) }, { message: 'Explain how it works.' });
  assert.equal(understood.passed, 1);
  assert.equal(understood.stageStart, 2);
  assert.deepEqual(stageTranscript(understood, { role: 'user', content: 'It sums tiny changes.' }), [understood.messages[2], { role: 'user', content: 'It sums tiny changes.' }]);
  assert.equal(targetCount('analyze'), 4);
});

test('an incomplete assessment cannot advance and a completed target remains complete until raised', () => {
  const remembered = { ...startConcepts([concept('integrals')])[0], target: 'remember', passed: 1 };
  assert.equal(remembered.passed, targetCount(remembered.target));
  const raised = { ...remembered, target: 'apply', messages: [...remembered.messages, { role: 'assistant', content: 'Explain integrals.' }], stageStart: remembered.messages.length };
  const result = advanceConcept(raised, [...raised.messages, { role: 'user', content: 'I am not sure.' }], { message: 'Could you say more?', expression: 'attentive', assessment: assessment(false) });
  assert.equal(result.passed, 1);
  assert.equal(result.stageStart, raised.stageStart);
});

test('reload restores a saved concept chat and gives older unopened concepts an opening', () => {
  const [first, second] = startConcepts([concept('integrals'), concept('derivatives')]);
  const restored = restoreLearning({ concepts: [first, second], activeId: 'derivatives', started: true });
  assert.equal(restored.started, true);
  assert.equal(restored.activeId, 'derivatives');
  assert.deepEqual(restored.concepts[0].messages, first.messages);
  const migrated = restoreLearning({ concepts: [first, concept('derivatives')], activeId: null, started: true });
  assert.deepEqual(migrated.concepts[1].messages, [{ role: 'assistant', content: 'Teach me about derivatives.' }]);
  assert.equal(restoreLearning({ concepts: [concept('integrals')], activeId: null, started: false }).started, false);
});

test('Analyze only advances when the specific criterion is supported', () => {
  const active = { ...concept('integrals'), passed: 3 };
  const messages = [{ role: 'assistant', content: 'Check my papers.' }, { role: 'user', content: 'I sorted them.' }];
  const incomplete = advanceConcept(active, messages, { message: 'Your learning report is ready.', expression: 'attentive', assessment: assessment(false), finalSummary: 'More evidence is needed.' });
  assert.equal(incomplete.passed, 3);
  const complete = advanceConcept(active, messages, { message: 'Your learning report is ready.', expression: 'excited', assessment: assessment(true), finalSummary: 'Criterion met.' });
  assert.equal(complete.passed, 4);
  assert.deepEqual(complete.messages, messages);
});

test('a completed concept stays quiet and the session ends only after every target is reached', () => {
  const [first, second] = startConcepts([concept('integrals', 'remember'), concept('derivatives', 'understand')]);
  const messages = [...first.messages, { role: 'user', content: 'An integral accumulates change.' }];
  const completed = advanceConcept(first, messages, { message: 'Thank you for teaching me!', expression: 'excited', assessment: assessment(true) });
  assert.deepEqual(completed.messages, messages);
  assert.equal(sessionComplete([completed, second]), false);
  assert.equal(sessionComplete([completed, { ...second, passed: 2 }]), true);
});

test('templates contain distinct checklist items and empty numbering cannot start a session', () => {
  const template = genericRubric('Capacitors', 'analyze');
  for (const value of Object.values(template)) assert.match(value, /^1\. .+\n2\. /);
  assert.equal(canStart([{ ...concept('empty', 'remember'), rubric: { remember: '1. ', understand: '', apply: '', analyze: '' } }]), false);
});

test('item judgments persist per level after advancement and reload', () => {
  const active = startConcepts([concept('capacitors', 'understand')])[0];
  const remembered = { ...assessment(true), criteria: [{ aspect: 'Mention A and B.', status: 'supported', result: 'correct', evidence: [{ messageIndex: 1, quote: 'A and B' }] }] };
  const next = advanceConcept(active, [...active.messages, { role: 'user', content: 'A and B' }], { message: 'Thanks!', expression: 'excited', assessment: remembered }, { message: 'Explain why.' });
  assert.deepEqual(next.assessments.remember, remembered);
  const updated = advanceConcept(next, [...next.messages, { role: 'user', content: 'Unsure.' }], { message: 'How?', expression: 'attentive', assessment: assessment(false) });
  assert.deepEqual(updated.assessments.remember, remembered);
  assert.equal(updated.assessments.understand.complete, false);
  const restored = restoreLearning({ concepts: [updated], activeId: updated.id, started: true });
  assert.deepEqual(restored.concepts[0].assessments, updated.assessments);
});
