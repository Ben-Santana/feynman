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
    assert.match(system, /ONE small question/);
    assert.match(system, /Do not request a full solution, multiple metrics/);
    return { strategyChoice: { strategyId: 'none', rationale: 'No suitable operation for this fixture.', targetQuote: '', rubricItem: '' }, message: 'What happens to a bacterium that cannot resist the treatment?', expression: 'confused' };
  });
  assert.deepEqual(calls, ['evaluate_refined', 'reply_to_teacher']);
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
    return { strategyChoice: { strategyId: 'none', rationale: 'No suitable operation for this fixture.', targetQuote: '', rubricItem: '' }, message: 'How does a leftward external impulse affect your signed momentum balance?', expression: 'confused' };
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
    return { strategyChoice: { strategyId: 'none', rationale: 'No suitable operation for this fixture.', targetQuote: '', rubricItem: '' }, message: 'What happens to the susceptible bacteria?', expression: 'attentive' };
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
    return { strategyChoice: { strategyId: 'none', rationale: 'No suitable operation for this fixture.', targetQuote: '', rubricItem: '' }, message: 'What sign did you use for the leftward velocity?', expression: 'confused' };
  };
  const open = await chat(body, query);
  assert.equal(open.finalSummary, undefined);
  assert.equal(open.assessment.complete, false);
  assert.deepEqual(names, ['evaluate_refined', 'reply_to_teacher']);
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
    assert.equal(tool.name, 'reply_to_teacher'); assert.match(system, /DIFFERENT self-contained situation/);
    return { strategyChoice: { strategyId: 'none', rationale: 'No suitable operation for this fixture.', targetQuote: '', rubricItem: '' }, message: 'A beetle population contains inherited color variants; what would you predict if predators favor one color?', expression: 'attentive' };
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

// Transfer is optional by default (plan.md §6); Apply and Analyze instead require
// the learner's own reasoning, so an answer echoing help stays open until checked.
for (const learningType of ['theoretical', 'quantitative', 'experimental', 'design']) {
  for (const level of ['apply', 'analyze'].filter(level => learningType !== 'quantitative' || level !== 'analyze')) test(`${learningType} ${level}: unverified independence stays open, transfer is optional, independent reasoning completes`, async () => {
    const body = { ...input(), learningType, level };
    let independent = false;
    const query = async (system, messages, tool) => {
      if (tool.name === 'evaluate_refined') {
        const data = JSON.parse(messages[0].content[0].text);
        assert.equal(data.definitions.at(-1).requiresTransfer, false);
        assert.equal(data.definitions.at(-1).requiresIndependent, true);
        const value = assessment(messages, 'supported');
        for (const j of value.judgments) {
          j.result = 'correct'; j.reasoning = 'valid';
          j.independentCheck = independent ? 'demonstrated' : 'not_demonstrated';
          if (j.criterionId === 'level_task') j.transferCheck = 'not_demonstrated';
        }
        return value;
      }
      if (tool.name === 'summarize_learning') return { summary: 'Independent reasoning demonstrated.' };
      return { strategyChoice: { strategyId: 'none', rationale: 'No suitable operation for this fixture.', targetQuote: '', rubricItem: '' }, message: 'If the external condition changes, how would your conclusion change, and why?', expression: 'attentive' };
    };
    const original = await chat(body, query);
    assert.equal(original.assessment.complete, false);
    assert.ok(original.assessment.refined.completion.blockers.some(b => /independent/.test(b.code)));
    assert.ok(!original.assessment.refined.completion.blockers.some(b => /transfer/.test(b.code)));
    body.messages.push({ role: 'assistant', content: original.message }, { role: 'user', content: 'A reasoned prediction worked out on my own.' });
    independent = true;
    assert.equal((await chat(body, query)).assessment.complete, true);
  });
}

test('quantitative analyze: a correct paper explanation finishes, an incorrect one gets a follow-up first', async () => {
  const body = { ...input(), learningType: 'quantitative', level: 'analyze', messages: [
    { role: 'assistant', content: 'Check these papers.', paper: { id: 'p', markdown: 'Tentative solution.' } },
    { role: 'user', content: 'Fail.', review: { paperId: 'p', grade: 'fail', selectedSteps: [1], explanation: '' } },
    { role: 'assistant', content: 'Why?' }, { role: 'user', content: 'Step 1 is wrong because the sign is fine.' },
  ] };
  let status = 'flawed';
  const query = async (system, messages, tool) => {
    if (tool.name === 'evaluate_refined') {
      assert.equal(JSON.parse(messages[0].content[0].text).definitions.at(-1).requiresTransfer, false);
      const value = assessment(messages, status);
      for (const j of value.judgments) { j.result = status === 'supported' ? 'correct' : 'incorrect'; j.reasoning = status === 'supported' ? 'valid' : 'flawed'; if (status === 'supported') j.independentCheck = 'demonstrated'; }
      return value;
    }
    if (tool.name === 'summarize_learning') return { summary: 'The learner explained the paper error.' };
    assert.doesNotMatch(system, /ONE materially changed condition/);
    // A different question each turn: an exact repeat is rejected as a stuck loop.
    return { message: status === 'supported' ? 'So the sign flips at step 1. What would make the result positive again?' : 'What does step 1 do to the sign of the result?', expression: 'confused' };
  };
  const followUp = await chat(body, query);
  assert.equal(followUp.finalSummary, undefined);
  assert.match(followUp.message, /step 1/);
  body.messages.push({ role: 'assistant', content: followUp.message }, { role: 'user', content: 'Step 1 flips the sign, so the result should be negative.' });
  status = 'supported';
  const finished = await chat(body, query);
  assert.equal(finished.assessment.complete, true);
  assert.equal(finished.finalSummary, 'The learner explained the paper error.');
});
