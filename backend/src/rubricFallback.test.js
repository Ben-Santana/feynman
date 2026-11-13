import test from 'node:test';
import assert from 'node:assert/strict';
import { rubricAttempts, skippedRubricItems } from '../../frontend/src/rubricFallback.js';
import { chat } from './chat.js';
import { advanceConcept, assessmentTranscript } from '../../frontend/src/learningFlow.ts';
const aspect = 'Stored energy';
const history = (count = 3) => [...Array.from({ length: count }, () => [{ role: 'assistant', content: 'Why?', rubricFocus: aspect }, { role: 'user', content: 'I am unsure.' }]).flat(), { role: 'assistant', content: 'Which field?', rubricFocus: aspect }];
const skip = { role: 'user', content: 'Skip this item.', skipRubricItem: aspect };
test('skip unlocks after three focused replies, excluding learning actions', () => {
  assert.equal(rubricAttempts(history(), aspect), 3);
  assert.throws(() => skippedRubricItems([...history(2), skip], [aspect]), /three times/);
  assert.deepEqual([...skippedRubricItems([...history(), skip], [aspect])], [aspect]);
  const messages = history(); messages[1].helpRequest = true;
  assert.throws(() => skippedRubricItems([...messages, skip], [aspect]), /three times/);
  assert.throws(() => skippedRubricItems([...history(), { ...skip, skipRubricItem: 'Other' }], [aspect]), /three times/);
});
test('skipping the last item advances without recording mastery and persists on restore', async () => {
  const messages = [...history(), skip];
  const result = await chat({ level: 'remember', topic: 'Capacitors', aspects: [aspect], messages }, async (_system, _messages, tool) => {
    assert.equal(tool.name, 'evaluate_learning');
    const judgment = { status: 'missing', result: 'undetermined', evidence: [] };
    return { reason: 'More evidence needed.', criteria: [{ aspect, ...judgment }], task: judgment };
  }, undefined, { evaluator: 'legacy' });
  assert.equal(result.assessment.complete, false);
  assert.equal(result.assessment.readyToAdvance, true);
  assert.equal(result.assessment.criteria[0].skipped, true);
  const concept = { passed: 0, target: 'understand', messages: [], stageStart: 0 };
  const next = advanceConcept(concept, messages, result, { message: 'Next level.' });
  assert.equal(next.passed, 1);
  assert.equal(next.assessments.remember.criteria[0].skipped, true);
  assert.equal(next.messages.at(-1).rubricFocus, undefined);
});
test('Analyze evidence from earlier levels cannot carry skips into the new level', () => {
  const messages = [...history(), skip];
  const transcript = assessmentTranscript({ passed: 3, stageStart: messages.length, messages }, { role: 'user', content: 'New answer' }, 'quantitative');
  assert.ok(transcript.every(message => !message.skipRubricItem && !message.rubricFocus));
});
test('after a skip, follow-up targets a remaining item and keeps the skipped marker', async () => {
  const other = 'Electric field';
  const messages = [...history(), skip];
  const result = await chat({ level: 'remember', topic: 'Capacitors', aspects: [aspect, other], messages }, async (system, _messages, tool) => {
    if (tool.name === 'reply_to_teacher') {
      assert.ok(system.includes('Do not ask about or require them again'));
      assert.ok(system.includes('unresolved requirement: "Electric field"'));
      return { message: 'Where is the field located?', expression: 'confused' };
    }
    const judgment = { status: 'missing', result: 'undetermined', evidence: [] };
    return { reason: 'More evidence needed.', criteria: [aspect, other].map(aspect => ({ aspect, ...judgment })), task: judgment };
  }, undefined, { evaluator: 'legacy' });
  assert.equal(result.rubricFocus, other);
  assert.equal(result.assessment.readyToAdvance, false);
  assert.equal(result.assessment.criteria[0].skipped, true);
});

test('frustration or profanity unlocks skipping immediately for that item', async () => {
  const { expressesFrustration, rubricSkipReason } = await import('../../frontend/src/rubricFallback.js');
  for (const content of ["I'm frustrated", 'This is so frustrating.', 'What the fuck does this mean?', 'This is bullshit.', 'I still don’t understand.', 'I give up.', 'Stop asking the same thing.']) {
    assert.equal(expressesFrustration(content), true, content);
    const messages = history(1); messages[1].content = content;
    assert.equal(rubricSkipReason(messages, aspect), 'frustration');
    assert.deepEqual([...skippedRubricItems([...messages, skip], [aspect])], [aspect]);
    assert.equal(rubricSkipReason(messages, 'Another item'), null);
  }
});

test('ordinary uncertainty, quoted profanity, and assistant frustration do not unlock early skipping', async () => {
  const { expressesFrustration, rubricSkipReason } = await import('../../frontend/src/rubricFallback.js');
  for (const content of ['I am unsure.', 'I need to understand this assignment.', 'The class is about energy.', 'The character says "what the fuck".', '> This is bullshit.\nHere is my explanation.', 'The word frustration appears in the source.']) assert.equal(expressesFrustration(content), false, content);
  const messages = history(1); messages[0].content = 'This is frustrating.';
  assert.equal(rubricSkipReason(messages, aspect), null);
  messages[1].content = 'This is frustrating.'; messages[1].helpRequest = true;
  assert.equal(rubricSkipReason(messages, aspect), null);
});

test('frustration in the opening answer is tied to the first assessed item', async () => {
  const { rubricSkipReason } = await import('../../frontend/src/rubricFallback.js');
  const messages = history(1); delete messages[0].rubricFocus;
  messages[1].content = "I'm frustrated. This makes no sense.";
  assert.equal(rubricSkipReason(messages, aspect), 'frustration');
  assert.deepEqual([...skippedRubricItems([...messages, skip], [aspect])], [aspect]);
});

test('a frustrated reply keeps the current unresolved item available to skip', async () => {
  const other = 'Electric field';
  const messages = history(1).slice(0, -1); messages[1].content = 'This is frustrating.';
  const result = await chat({ level: 'remember', topic: 'Capacitors', aspects: [other, aspect], messages }, async (system, _messages, tool) => {
    if (tool.name === 'reply_to_teacher') {
      assert.ok(system.includes('unresolved requirement: "Stored energy"'));
      return { message: 'Where is the energy stored?', expression: 'confused' };
    }
    const judgment = { status: 'missing', result: 'undetermined', evidence: [] };
    return { reason: 'More evidence needed.', criteria: [other, aspect].map(aspect => ({ aspect, ...judgment })), task: judgment };
  }, undefined, { evaluator: 'legacy' });
  assert.equal(result.rubricFocus, aspect);
  assert.deepEqual([...skippedRubricItems([...messages, { role: 'assistant', content: result.message, rubricFocus: result.rubricFocus }, skip], [other, aspect])], [aspect]);
});

test('a skip lasts until later teaching demonstrates the item in the same level', async () => {
  const other = 'Stored charge';
  const messages = [...history(), skip, { role: 'assistant', content: 'What about charge?', rubricFocus: other }, { role: 'user', content: 'Energy is stored in the electric field.' }];
  const evaluate = status => async (_system, _messages, tool) => {
    if (tool.name !== 'evaluate_learning') return { message: 'What changes if the plates move apart?', expression: 'attentive' };
    const evidence = status === 'supported' ? [{ messageIndex: messages.length - 1, quote: 'stored in the electric field' }] : [];
    const judgment = { status: 'missing', result: 'undetermined', evidence: [] };
    return { reason: 'Assessed.', criteria: [{ aspect, status, result: status === 'supported' ? 'correct' : 'undetermined', evidence }, { aspect: other, ...judgment }], task: judgment };
  };
  const recovered = await chat({ level: 'remember', topic: 'Capacitors', aspects: [aspect, other], messages }, evaluate('supported'), undefined, { evaluator: 'legacy' });
  assert.equal(recovered.assessment.criteria[0].skipped, undefined);
  assert.equal(recovered.assessment.criteria[0].status, 'supported');
  const open = await chat({ level: 'remember', topic: 'Capacitors', aspects: [aspect, other], messages }, evaluate('missing'), undefined, { evaluator: 'legacy' });
  assert.equal(open.assessment.criteria[0].skipped, true);
});

test('later levels check off earlier skips without blocking the turn', async () => {
  const messages = [{ id: 'q1', role: 'assistant', content: 'Why does it charge?' }, { id: 'a1', role: 'user', content: 'Charge piles up and the energy is stored in the electric field.' }];
  const missing = { status: 'missing', result: 'undetermined', evidence: [] };
  const run = refinedQuery => async (system, sent, tool, options) => {
    if (tool.name === 'evaluate_refined') return refinedQuery(system, sent, tool, options);
    if (tool.name === 'evaluate_learning') return { reason: 'Assessed.', criteria: [{ aspect: 'Explain charging', ...missing }], task: missing };
    return { message: 'What changes if the plates move apart?', expression: 'attentive' };
  };
  const judged = (criterionId, status, patch = {}) => ({ criterionId, status, result: status === 'supported' ? 'correct' : 'undetermined', reasoning: status === 'supported' ? 'valid' : 'unclear', opportunity: 'fair', reason: 'Named the stored energy.', abstentionReason: '', observations: status === 'supported' ? [{ evidenceId: 'e1', assistance: 'none', assistanceMessageIds: [] }] : [], contradictions: [], partialCredit: { awarded: false, reason: '' }, ...patch });
  const request = { level: 'understand', topic: 'Capacitors', aspects: ['Explain charging'], messages };
  const openSkips = [{ id: 'c:remember:1', level: 'remember', text: aspect }];
  const result = await chat(request, run(async () => ({ reason: 'Assessed.', nextEvidenceObjective: '', evidence: [{ id: 'e1', messageId: 'a1', quote: 'the energy is stored in the electric field' }], judgments: [judged('criterion_1', 'supported'), judged('level_task', 'supported')] })), undefined, { evaluator: 'legacy', openSkips });
  assert.deepEqual(result.assessment.skipRecovery.map(r => [r.id, r.status, r.credit, r.mistake]), [['c:remember:1', 'demonstrated', 1, false]]);
  const concept = { passed: 1, target: 'analyze', messages: [], stageStart: 0, assessments: { remember: { complete: false, reason: '', task: missing, criteria: [{ aspect, ...missing, skipped: true }, { aspect: 'Other', ...missing, skipped: true }] } } };
  const next = advanceConcept(concept, messages, result);
  assert.deepEqual(next.assessments.remember.criteria.map(c => [c.status, c.skipped]), [['supported', undefined], ['missing', true]]);
  const failed = await chat(request, run(async () => { throw new Error('Evaluator offline'); }), undefined, { evaluator: 'legacy', openSkips });
  assert.deepEqual(failed.assessment.skipRecovery, []);
  assert.equal(failed.message, 'What changes if the plates move apart?');

  for (const validRecovery of [true, false]) {
    const calls = [];
    const combined = await chat(request, async (_, sent, tool) => {
      calls.push(tool.name);
      assert.equal(tool.name, 'evaluate_with_recovery');
      const [activeMaterial, recoveryMaterial] = sent[0].content.map(block => JSON.parse(block.text));
      assert.equal(activeMaterial.level, 'understand');
      assert.equal(recoveryMaterial[0].material.level, 'remember');
      assert.equal(recoveryMaterial[0].material.transcript, undefined);
      const assessment = {
        reason: 'Assessed.', nextEvidenceObjective: '',
        evidence: [{ id: 'e1', messageId: 'a1', quote: 'the energy is stored in the electric field' }],
        judgments: [judged('criterion_1', 'supported'), judged('level_task', 'supported')],
      };
      return { active: assessment, recovery_1: validRecovery ? assessment : { judgments: {} } };
    }, undefined, { openSkips, skipRecoveryMode: 'combined' });
    assert.deepEqual(calls, ['evaluate_with_recovery']);
    assert.equal(combined.assessment.complete, true);
    assert.deepEqual(combined.assessment.skipRecovery, validRecovery ? result.assessment.skipRecovery : []);
  }
});


test('declining a skip clears old frustration and attempts, then permits a later offer', async () => {
  const { rubricSkipReason } = await import('../../frontend/src/rubricFallback.js');
  const messages = history(); messages[1].content = 'This is frustrating.';
  messages.at(-1).skipOfferDeclined = true;
  assert.equal(rubricSkipReason(messages, aspect), null);
  assert.equal(rubricSkipReason(messages.slice(0, -1), aspect), 'frustration');
  for (let i = 0; i < 3; i++) {
    messages.push({ role: 'user', content: 'Another attempt.' }, { role: 'assistant', content: 'Why?', rubricFocus: aspect });
    assert.equal(rubricSkipReason(messages, aspect), i === 2 ? 'attempts' : null);
  }
  assert.deepEqual([...skippedRubricItems([...messages, skip], [aspect])], [aspect]);
});
