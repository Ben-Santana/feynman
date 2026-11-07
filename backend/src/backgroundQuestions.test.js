import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, validate } from './chat.js';
import { inlineQuestionStrategies } from './inlineQuestionStrategies.js';
import { backgroundForChoice, backgroundStrategyId, validateBackgroundHistory, backgroundChoiceSchema } from './backgroundQuestions.js';
import { comparisonCases, retrieveStrategies, strategies } from './questionStrategies.js';
import { coreGenerationContext, validateSelection } from './strategyPlanning.js';
import { advanceConcept, restoreLearning, stageTranscript } from '../../frontend/src/learningFlow.ts';

const initial = () => ({ level: 'understand', learningType: 'theoretical', topic: 'Terminal velocity', aspects: ['Explain constant velocity using forces and acceleration.'], messages: [{ role: 'assistant', content: 'How do forces and acceleration explain the constant speed of this falling object?' }, { role: 'user', content: 'It must accelerate because it moves fast. I cannot remember how acceleration relates to net force.' }] });
const bridge = { action: 'probe', originalMessageIndex: 0, prerequisite: 'The relationship between net force and acceleration', probeLevel: 'understand', returnTarget: 'Connect the force-acceleration relationship to the original constant-speed explanation.' };
const choice = (input, action = 'probe') => ({ strategyId: backgroundStrategyId, rationale: 'Check the stated prerequisite obstacle, then reconnect it.', targetQuote: input.messages[1].content, rubricItem: input.aspects[0], background: { ...bridge, action } });
function evaluation(messages, { supported = false, scope } = {}) {
  const data = JSON.parse(messages[0].content[0].text), learner = data.transcript.findLast(m => m.role === 'user');
  return { reason: 'Current task evidence checked.', nextEvidenceObjective: supported ? '' : 'Explain the original force and acceleration relationship.', judgments: data.definitions.map(d => ({ criterionId: d.id, status: supported ? 'supported' : 'flawed', result: supported ? 'correct' : 'incorrect', reasoning: supported ? 'valid' : 'flawed', opportunity: 'fair', abstentionReason: '', ...(d.requiresIndependent ? { independentCheck: supported ? 'demonstrated' : 'not_demonstrated' } : {}), ...(d.requiresTransfer ? { transferCheck: supported ? 'demonstrated' : 'not_demonstrated' } : {}), observations: [{ messageId: learner.messageId, quote: learner.content, ...(d.requiresIndependent ? { assistance: 'none', assistanceMessageIds: [] } : {}), ...(d.requiresTransfer ? { demonstratesTransfer: supported } : {}) }], contradictions: [] })), ...(scope ? { backgroundResponseScope: scope } : {}) };
}
function afterProbe(input = initial(), answer = 'Acceleration depends on net force.') {
  const background = backgroundForChoice(input, choice(input));
  return { ...input, messages: [...input.messages, { role: 'assistant', content: 'How is acceleration related to net force?', background }, { role: 'user', content: answer }] };
}

test('ordinary chat probes, returns, and completes only after original-task evidence using existing calls', async () => {
  const calls = [], input = initial();
  const first = await chat(input, async (instructions, messages, tool) => {
    calls.push(tool.name);
    if (tool.name === 'evaluate_refined') return evaluation(messages);
    assert.match(instructions, /Background bridge policy/);
    return { message: 'How is acceleration related to the net force on an object?', expression: 'attentive', strategyChoice: choice(input) };
  });
  assert.equal(first.background.probeCount, 1);
  assert.equal(first.background.taskLevel, 'understand');
  const next = { ...input, messages: [...input.messages, { role: 'assistant', content: first.message, background: first.background }, { role: 'user', content: 'Acceleration depends on net force.' }] };
  const returned = await chat(next, async (instructions, messages, tool) => {
    calls.push(tool.name);
    if (tool.name === 'evaluate_refined') {
      assert.ok(tool.schema.required.includes('backgroundResponseScope'));
      const data = JSON.parse(messages[0].content[0].text);
      assert.equal(data.transcript.at(-2).background.probeLevel, 'understand');
      assert.equal(data.transcript.at(-2).originalTaskQuestion, input.messages[0].content);
      // Even mistaken supported labels cannot pass a prerequisite-only answer.
      return evaluation(messages, { supported: true, scope: { originalTaskDemonstrated: false, quote: '' } });
    }
    assert.match(instructions, /pending sequence/);
    return { message: 'How does that relationship help explain the constant speed in our original situation?', expression: 'attentive', strategyChoice: choice(input, 'return') };
  });
  assert.equal(returned.assessment.complete, false);
  assert.ok(returned.assessment.task.status !== 'supported');
  assert.equal(returned.background.phase, 'return');
  const final = { ...input, messages: [...next.messages, { role: 'assistant', content: returned.message, background: returned.background }, { role: 'user', content: 'Constant velocity means zero acceleration, so the upward drag balances gravity and the net force is zero.' }] };
  const done = await chat(final, async (_, messages, tool) => { calls.push(tool.name); return evaluation(messages, { supported: true }); });
  assert.equal(done.assessment.complete, true);
  assert.deepEqual(calls, ['evaluate_refined', 'reply_to_teacher', 'evaluate_refined', 'reply_to_teacher', 'evaluate_refined']);
});

test('two probes force a return or exit and prevent repeated detours for the same task', () => {
  const one = afterProbe();
  const second = backgroundForChoice(one, choice(one));
  assert.equal(second.probeCount, 2);
  const two = { ...one, messages: [...one.messages, { role: 'assistant', content: 'What changes when the net force changes?', background: second }, { role: 'user', content: 'I still do not know.' }] };
  assert.throws(() => backgroundForChoice(two, choice(two)), /Two background probes/);
  assert.throws(() => backgroundForChoice(two, { strategyId: 'none' }), /pending background bridge/);
  const exit = backgroundForChoice(two, choice(two, 'exit'));
  assert.equal(exit.probeCount, 2);
  const ended = { ...two, messages: [...two.messages, { role: 'assistant', content: 'Would you like to revisit what constant speed describes or ask for help?', background: exit }, { role: 'user', content: 'Revisit constant speed.' }] };
  assert.throws(() => backgroundForChoice(ended, choice(ended)), /do not reopen/);
  assert.doesNotThrow(() => backgroundForChoice(ended, { strategyId: 'none' }));
});

test('invalid third-probe generation retries the response without repeating evaluation', async () => {
  const one = afterProbe(), second = backgroundForChoice(one, choice(one));
  const input = { ...one, messages: [...one.messages, { role: 'assistant', content: 'Which part of that relationship is missing?', background: second }, { role: 'user', content: 'I cannot recall it.' }] };
  const names = [];
  let responses = 0;
  const result = await chat(input, async (_, messages, tool) => {
    names.push(tool.name);
    if (tool.name === 'evaluate_refined') return evaluation(messages);
    return { message: responses++ ? 'Would you like to revisit constant speed or request help?' : 'What is the relationship between acceleration and net force?', expression: 'attentive', strategyChoice: choice(input, responses === 1 ? 'probe' : 'exit') };
  });
  assert.equal(result.background.phase, 'exit');
  assert.deepEqual(names, ['evaluate_refined', 'reply_to_teacher', 'reply_to_teacher']);
});

test('a volunteered solution while answering a probe can complete without a redundant return', async () => {
  const answer = 'Constant velocity means zero acceleration, so gravity and drag balance and the net force is zero.';
  const input = afterProbe(initial(), answer);
  const result = await chat(input, async (_, messages, tool) => {
    assert.equal(tool.name, 'evaluate_refined');
    return evaluation(messages, { supported: true, scope: { originalTaskDemonstrated: true, quote: answer } });
  });
  assert.equal(result.assessment.complete, true);
});

test('invented or absent original-task scope cannot pass a background-only answer', async () => {
  for (const scope of [undefined, { originalTaskDemonstrated: true, quote: 'Invented original solution.' }]) {
    const input = afterProbe();
    const result = await chat(input, async (_, messages, tool) => tool.name === 'evaluate_refined'
      ? evaluation(messages, { supported: true, scope })
      : { message: 'How does that relationship help explain the original constant-speed situation?', expression: 'attentive', strategyChoice: choice(input, 'return') });
    assert.equal(result.assessment.complete, false);
    assert.ok(result.assessment.refined.completion.blockers.some(b => b.code === 'background_only_evidence'));
  }
});

test('stage-linked metadata rejects changed anchors, roles, levels, and silently dropped return paths', () => {
  const valid = afterProbe();
  assert.deepEqual(backgroundChoiceSchema(valid).anyOf[1].properties.originalMessageIndex.enum, [0], 'Saved-stage indices exclude model setup messages and existing probes.');
  for (const change of [{ topic: 'Another topic' }, { taskLevel: 'apply' }, { originalMessageIndex: 1 }, { targetMessageIndex: 0 }, { targetQuote: 'Invented' }, { probeCount: 3 }, { probeLevel: 'apply' }, { rubricItem: 'Invented' }]) {
    const input = structuredClone(valid);
    Object.assign(input.messages[2].background, change);
    assert.throws(() => validate(input), /Invalid background/);
  }
  const userMetadata = structuredClone(valid); userMetadata.messages[3].background = userMetadata.messages[2].background;
  assert.throws(() => validate(userMetadata), /Invalid background/);
  const dropped = { ...valid, messages: [...valid.messages, { role: 'assistant', content: 'An unrelated question?' }, { role: 'user', content: 'Why did we move on?' }] };
  assert.throws(() => validate(dropped), /Invalid background/);
});

test('requesting prerequisite help closes a pending detour and preserves assistance provenance', async () => {
  const input = afterProbe(); input.messages.at(-1).helpRequest = true;
  const result = await chat(input, async (_, __, tool) => {
    assert.equal(tool.name, 'review_prerequisite');
    return { explanation: 'For a fixed mass, acceleration changes with the net force.' };
  });
  assert.equal(result.assistance, true);
  assert.equal(result.background.phase, 'exit');
  const next = { ...input, messages: [...input.messages, { role: 'assistant', content: result.message, assistance: true, background: result.background }, { role: 'user', content: 'I am ready to try again.' }] };
  assert.equal(validateBackgroundHistory(next).phase, 'exit');
});

test('Quantitative Analyze can retain completed earlier-stage detours as inactive conversation history', async () => {
  const prior = afterProbe();
  const full = { ...prior, level: 'analyze', learningType: 'quantitative', aspects: ['Analyze the submitted solution.'], messages: [...prior.messages, { role: 'assistant', content: 'Apply the relationship.', passedLevel: 'understand' }, { role: 'user', content: 'I applied it.' }, { role: 'assistant', content: 'Review these worked solutions.', passedLevel: 'apply' }, { role: 'user', content: 'Here is my review.' }] };
  assert.doesNotThrow(() => validate(full));
  assert.equal(validateBackgroundHistory(full), null);
  const { createEvaluationContext } = await import('./evaluatorContracts.js');
  const { evaluatorMaterial } = await import('./refinedEvaluator.js');
  const { loadPrompts } = await import('./promptStore.js');
  const data = JSON.parse(evaluatorMaterial(createEvaluationContext(full), loadPrompts()).messages[0].content[0].text);
  assert.ok(data.transcript.every(m => !m.background));
});

test('background bridge is eligible only in its supported task scope and developer context carries a real return path', () => {
  const strategy = strategies.find(s => s.id === backgroundStrategyId);
  for (const level of ['understand', 'apply', 'analyze']) {
    const fixture = comparisonCases.find(c => c.expectedStrategyId === backgroundStrategyId && c.level === level);
    assert.ok(retrieveStrategies(null, fixture).some(c => c.strategy.id === strategy.id));
    const plan = { targetMessageIndex: 1, targetQuote: fixture.messages[1].content, rubricItem: fixture.aspects[0], objective: 'Elicit a prerequisite.', scenario: fixture.messages[0].content, assumptions: [], heldFixed: [], varied: [], construction: 'Ask one prerequisite question.', prerequisitesSatisfied: 'The target prerequisite is intentionally uncertain.', limitations: [], responseSignals: [{ hypothesis: 'Available', responsePattern: 'Explains the relationship.', interpretation: 'Return to the task.' }, { hypothesis: 'Unavailable', responsePattern: 'Cannot recall.', interpretation: 'Narrow once or exit.' }], background: { ...bridge, returnTarget: fixture.aspects[0] } };
    const selected = { strategyId: backgroundStrategyId, rationale: 'Probe a specific prerequisite.', plan };
    assert.equal(validateSelection(selected, [{ strategy }], fixture), strategy);
    assert.equal(coreGenerationContext(fixture, strategy, plan).background.originalMessageIndex, 0);
  }
  for (const input of [{ ...initial(), level: 'remember' }, { ...initial(), level: 'analyze', learningType: 'quantitative' }]) assert.ok(!retrieveStrategies(null, input).some(c => c.strategy.id === backgroundStrategyId));
  assert.ok(!inlineQuestionStrategies(initial()).instructions.includes('frustrated student'));
});

test('saved conversation retains background context and the next stage starts without its pending detour', () => {
  const input = initial(), background = backgroundForChoice(input, choice(input));
  const concept = { id: 'falling', name: input.topic, target: 'apply', passed: 1, stageStart: 0, rubric: { remember: 'Recall a force', understand: input.aspects[0], apply: 'Apply the relationship', analyze: 'Analyze the relationship' }, messages: [], draft: '', assessment: null };
  const result = { message: 'How is acceleration related to net force?', expression: 'attentive', assessment: { complete: false }, background };
  const pending = advanceConcept(concept, input.messages, result);
  const restored = restoreLearning(JSON.parse(JSON.stringify({ concepts: [pending], activeId: pending.id, started: true })));
  const next = stageTranscript(restored.concepts[0], { role: 'user', content: 'Acceleration depends on net force.' });
  assert.deepEqual(next.at(-2).background, background);
  assert.equal(validateBackgroundHistory({ ...input, messages: next }).phase, 'probe');
  const advanced = advanceConcept(pending, next, { message: 'Complete.', expression: 'excited', assessment: { complete: true } }, { message: 'Use the relationship in a new task.' });
  assert.ok(!stageTranscript(advanced, { role: 'user', content: 'Here is my prediction.' }).some(m => m.background));
  assert.doesNotThrow(() => validate({ ...input, level: 'apply', messages: [], priorMessages: next }));
});
