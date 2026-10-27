import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { EvaluationCache } from './turnCache.js';
import { createEvaluationContext } from './evaluatorContracts.js';

const input = () => ({ level: 'apply', learningType: 'theoretical', topic: 'Selection', aspects: ['Explain differential survival'], messages: [{ role: 'assistant', content: 'What happens during treatment?' }, { role: 'user', content: 'Every bacterium learns resistance.' }] });
function assessment(messages, status = 'flawed') {
  const data = JSON.parse(messages[0].content[0].text), user = data.transcript.findLast(m => m.role === 'user');
  return { reason: 'The causal explanation is not supported.', nextEvidenceObjective: 'Explain survival.', judgments: data.definitions.map(d => ({ criterionId: d.id, status, result: 'incorrect', reasoning: 'flawed', opportunity: 'fair', abstentionReason: '', ...(d.requiresIndependent ? { independentCheck: 'not_demonstrated' } : {}), ...(d.requiresTransfer ? { transferCheck: 'not_demonstrated' } : {}), observations: [{ messageId: user.messageId, quote: user.content, ...(d.requiresIndependent ? { assistance: 'none', assistanceMessageIds: [] } : {}), ...(d.requiresTransfer ? { demonstratesTransfer: false } : {}) }], contradictions: [] })) };
}

test('production follow-up needs only evaluator and reply, targeting one misconception', async () => {
  const calls = [];
  const result = await chat(input(), async (system, messages, tool) => {
    calls.push(tool.name);
    if (tool.name === 'evaluate_refined') return assessment(messages);
    assert.match(system, /ONE small diagnostic question/);
    assert.match(system, /Do not request a full solution, multiple metrics/);
    return { message: 'What happens to a bacterium that cannot resist the treatment?', expression: 'confused' };
  });
  assert.deepEqual(calls, ['evaluate_refined', 'respond_to_student']);
  assert.equal(result.assessment.complete, false);
});

test('a cited contradiction takes priority over the first flawed rubric row', async () => {
  const body = input(); body.aspects.push('Explain signed external impulse');
  await chat(body, async (system, messages, tool) => {
    if (tool.name === 'evaluate_refined') {
      const value = assessment(messages);
      const observation = value.judgments[1].observations[0];
      value.judgments[1].contradictions = [{ messageId: observation.messageId, quote: observation.quote, reason: 'This claim contradicts the signed balance.' }];
      return value;
    }
    assert.match(system, /unresolved requirement: "Explain signed external impulse"/);
    return { message: 'How does a leftward external impulse affect your signed momentum balance?', expression: 'confused' };
  });
});

test('reply failure reuses completed evaluation only for exact scoped prompt and input', async () => {
  const cache = new EvaluationCache(), options = { evaluationCache: cache, cacheScope: ['account-a', 'provider', 'model'] };
  let evaluations = 0;
  const query = async (_, messages, tool) => {
    if (tool.name === 'evaluate_refined') { evaluations++; return assessment(messages); }
    throw new Error('Disconnected');
  };
  await assert.rejects(chat(input(), query, undefined, options), /Disconnected/);
  const result = await chat(input(), async (_, messages, tool) => {
    if (tool.name === 'evaluate_refined') assert.fail('Should reuse validated assessment');
    return { message: 'What happens to the susceptible bacteria?', expression: 'attentive' };
  }, undefined, options);
  assert.equal(result.evaluationReused, true);
  assert.equal(evaluations, 1);
  await assert.rejects(chat(input(), query, undefined, { ...options, cacheScope: ['account-b', 'provider', 'model'] }), /Disconnected/);
  assert.equal(evaluations, 2);
  const changed = input(); changed.messages[1].content = 'I do not know.';
  await assert.rejects(chat(changed, query, undefined, options), /Disconnected/);
  assert.equal(evaluations, 3);
});

test('evaluation cache expires and evicts entries without persisting transcript data', () => {
  let now = 0;
  const cache = new EvaluationCache({ ttl: 10, limit: 1, now: () => now });
  cache.set('a', { complete: false }); cache.set('b', { complete: true });
  assert.equal(cache.get('a'), undefined);
  now = 11; assert.equal(cache.get('b'), undefined);
});

test('weak quantitative analysis stays open until explicit finish', async () => {
  const body = { ...input(), level: 'analyze', learningType: 'quantitative', messages: [
    { role: 'assistant', content: 'Check the momentum.', paper: { id: 'p', markdown: 'Proposed calculation.' } },
    { role: 'user', content: 'Pass.', review: { paperId: 'p', grade: 'pass', selectedSteps: [], explanation: '' } },
    { role: 'assistant', content: 'How did you check it?' }, { role: 'user', content: 'I guessed.' },
  ] };
  const names = [];
  const query = async (_, messages, tool) => {
    names.push(tool.name);
    if (tool.name === 'evaluate_refined') return assessment(messages);
    if (tool.name === 'summarize_learning') return { summary: 'The momentum reasoning needs more evidence.' };
    return { message: 'What sign did you use for the leftward velocity?', expression: 'confused' };
  };
  const open = await chat(body, query);
  assert.equal(open.finalSummary, undefined);
  assert.equal(open.assessment.complete, false);
  assert.deepEqual(names, ['evaluate_refined', 'respond_to_student']);
  body.messages[3].finishAssessment = true;
  const finished = await chat(body, query);
  assert.ok(finished.finalSummary);
  assert.equal(finished.assessment.complete, false);
});

test('latest revised paper review controls explanation eligibility', () => {
  const body = { ...input(), learningType: 'quantitative', level: 'analyze', messages: [
    { role: 'assistant', content: 'Check.', paper: { id: 'p', markdown: 'Paper' } },
    { role: 'user', content: 'Pass.', review: { paperId: 'p', grade: 'pass', explanation: '' } },
    { role: 'assistant', content: 'Why?' }, { role: 'user', content: 'A first explanation.' },
    { role: 'assistant', content: 'Check again.' },
    { role: 'user', content: 'Fail.', review: { paperId: 'p', grade: 'fail', selectedSteps: [1], explanation: '' } },
  ] };
  const context = createEvaluationContext(body);
  assert.equal(context.reviewIndex, 5);
  assert.equal(context.eligibility, 'awaiting_paper_review_explanation');
});

test('prerequisite help is labeled assistance and readiness generates a fresh check without evaluation', async () => {
  const body = input(); body.messages[1].helpRequest = true;
  const help = await chat(body, async (system, _, tool) => {
    assert.equal(tool.name, 'review_prerequisite');
    assert.match(system, /Do not solve the current assessment/);
    return { explanation: 'A population contains individuals with different inherited traits.' };
  });
  assert.equal(help.assistance, true); assert.equal(help.assessment, null);
  body.messages.push({ role: 'assistant', content: help.message, assistance: true }, { role: 'user', content: 'Ready.' });
  const check = await chat(body, async (system, _, tool) => {
    assert.equal(tool.name, 'respond_to_student'); assert.match(system, /DIFFERENT self-contained situation/);
    return { message: 'A beetle population contains inherited color variants; what would you predict if predators favor one color?', expression: 'attentive' };
  });
  assert.equal(check.independentCheck, true); assert.equal(check.assessment, null);
  assert.ok(createEvaluationContext(body).criteria.every(c => c.requiresIndependent));
});

test('help retries an embedded practice question instead of showing two competing checks', async () => {
  const body = input(); body.messages.at(-1).helpRequest = true;
  let calls = 0;
  const help = await chat(body, async (system, _, tool) => {
    assert.equal(tool.name, 'review_prerequisite');
    assert.match(system, /Do not ask any question or assign practice/);
    return { explanation: ++calls === 1 ? 'RC is time. What is RC for 3 kohms and 20 nF?' : 'Resistance times capacitance has units of time. For example, 2 kohms times 10 nF is 20 microseconds.' };
  });
  assert.equal(calls, 2);
  assert.equal(help.assistance, true);
  assert.doesNotMatch(help.message, /\?/);
});

for (const learningType of ['theoretical', 'quantitative', 'experimental', 'design']) {
  for (const level of ['apply', 'analyze']) test(`${learningType} ${level}: original solution cannot bypass independent transfer, changed-condition reasoning can complete`, async () => {
    const body = { ...input(), learningType, level };
    if (learningType === 'quantitative' && level === 'analyze') body.messages = [
      { role: 'assistant', content: 'Check these papers.', paper: { id: 'p', markdown: 'Tentative solution.' } },
      { role: 'user', content: 'Fail.', review: { paperId: 'p', grade: 'fail', selectedSteps: [1], explanation: '' } },
      { role: 'assistant', content: 'Why?' }, { role: 'user', content: 'Explanation of the original problem.' },
    ];
    let transferred = false;
    const query = async (system, messages, tool) => {
      if (tool.name === 'evaluate_refined') {
        const data = JSON.parse(messages[0].content[0].text);
        assert.equal(data.definitions.at(-1).requiresTransfer, true);
        assert.equal(data.definitions.at(-1).requiresIndependent, true);
        assert.match(system, /not new numbers alone/);
        const value = assessment(messages, 'supported');
        for (const j of value.judgments) {
          j.result = 'correct'; j.reasoning = 'valid';
          if (j.criterionId === 'level_task') {
            j.independentCheck = 'demonstrated';
            j.transferCheck = transferred ? 'demonstrated' : 'not_demonstrated';
            j.observations[0].demonstratesTransfer = transferred;
          }
        }
        return value;
      }
      if (tool.name === 'summarize_learning') return { summary: 'Independent changed-condition reasoning demonstrated.' };
      assert.match(system, /ONE materially changed condition/);
      assert.match(system, /do not repeat every rubric item/i);
      return { message: 'If the external condition changes, how would your conclusion change, and why?', expression: 'attentive' };
    };
    const original = await chat(body, query);
    assert.equal(original.assessment.complete, false);
    assert.equal(original.assessment.criteria.every(c => c.status === 'supported'), true);
    assert.ok(original.assessment.refined.completion.blockers.some(b => /transfer/.test(b.code)));
    body.messages.push({ role: 'assistant', content: original.message }, { role: 'user', content: 'A reasoned independent prediction under the changed condition.' });
    transferred = true;
    assert.equal((await chat(body, query)).assessment.complete, true);
  });
}
