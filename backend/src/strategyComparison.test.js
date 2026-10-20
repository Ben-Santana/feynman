import test from 'node:test';
import assert from 'node:assert/strict';
import { compareQuestions } from './strategyComparison.js';
import { comparisonCases, retrieveStrategies, strategies } from './questionStrategies.js';
import { chat as conversationChat, validate } from './chat.js';
import { strategyLevelInstructions, strategyExampleContext, clearQuestionInstructions, coreGenerationContext, validateSelection } from './strategyPlanning.js';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';
import { testAuthorization, testAccountService } from './accessTestHelper.js';
import { readFileSync } from 'node:fs';

function fakeQuery({ invalidEvidence = false, complete = false, caseId = 'inertia' } = {}) {
  const fixture = comparisonCases.find(item => item.id === caseId);
  return async (instructions, messages, response) => {
    if (response.name === 'evaluate_learning') {
      const aspects = response.schema.properties.criteria.items.properties.aspect.enum;
      const judgment = { status: complete ? 'supported' : 'flawed', result: complete ? 'correct' : 'incorrect', evidence: [{ messageIndex: 3, quote: fixture.messages[3].content }] };
      return { reason: 'Reasoning needs clarification.', nextQuestionFocus: 'Motion after the push.', criteria: aspects.map(aspect => ({ aspect, ...judgment })), task: judgment };
    }
    if (response.name === 'diagnose_understanding') return { understands: ['Motion continues initially'], potentialMisconceptions: ['Stored push gets used up'], missingConcepts: ['net force'], uncertainty: ['Meaning of force'], diagnosticObjective: 'Distinguish force from velocity', evidence: [{ messageIndex: invalidEvidence ? 0 : 3, quote: invalidEvidence ? fixture.messages[0].content : fixture.messages[3].content }] };
    if (response.name === 'select_strategy') return { strategyId: 'remove-condition', rationale: 'Probe the state after the initiating condition ends.', plan: {
      targetMessageIndex: 3, targetQuote: fixture.messages[3].content, rubricItem: fixture.aspects[0],
      objective: 'Distinguish continued motion from a continued interaction.', scenario: 'The object moves on a horizontal frictionless surface after contact ends.',
      assumptions: ['No horizontal external interaction'], heldFixed: ['Surface and object'], varied: ['Contact with the initiating agent'],
      construction: 'Ask about one consequence after contact ends.', prerequisitesSatisfied: 'The student discusses the state after the push.', limitations: ['A prediction alone is ambiguous.'],
      responseSignals: [{ hypothesis: 'Stored push', responsePattern: 'The object slows because the push expires.', interpretation: 'Supports the stored-push hypothesis if friction is excluded.' }, { hypothesis: 'No net influence', responsePattern: 'Velocity remains constant.', interpretation: 'Needs a specific explanation before establishing understanding.' }],
    } };
    if (response.name === 'validate_strategy_application') return { usable: true, reason: 'The diagnostic structure and topic are preserved.' };
    if (response.name === 'respond_to_student') return { message: instructions.includes('Apply the following diagnostic strategy') ? 'On a frictionless surface, what happens to the puck after the push ends?' : 'Could you explain what you mean by stored force?', expression: 'confused' };
    throw new Error(`Unexpected ${response.name}`);
  };
}
test('paired generation shares transcript and rubric evaluation, with auditable strategy selection', async () => {
  const result = await compareQuestions('inertia', fakeQuery());
  assert.notEqual(result.baseline.message, result.enhanced.message);
  assert.equal(result.strategy.id, 'remove-condition');
  assert.equal(result.questionPlan.targetQuote, comparisonCases[0].messages[3].content);
  assert.equal(result.calls.filter(call => call.name === 'evaluate_learning').length, 1);
  const learners = result.calls.filter(call => call.name === 'respond_to_student');
  assert.deepEqual(learners[0].request.messages, learners[1].request.messages);
  assert.equal(learners[0].request.instructions.includes('Apply the following diagnostic strategy'), false);
  assert.equal(learners[1].request.instructions.includes('Apply the following diagnostic strategy'), true);
});

test('positive-work case retries generic questions in both branches without repeating evaluation', async () => {
  const fallback = fakeQuery({ caseId: 'indirect-work' });
  let defaultAttempts = 0, strategyAttempts = 0;
  const result = await compareQuestions('indirect-work', async (instructions, messages, response, options) => {
    if (response.name !== 'respond_to_student') return fallback(instructions, messages, response, options);
    assert.match(instructions, /Every question must identify one concrete claim/);
    if (instructions.includes('Apply the following diagnostic strategy')) {
      if (++strategyAttempts === 1) return { message: 'The cart keeps moving. Could you explain your thinking?', expression: 'confused' };
      return { message: 'What interaction would increase the cart’s kinetic energy after the push ends on the frictionless track?', expression: 'confused' };
    }
    if (++defaultAttempts === 1) return { message: 'Could you walk me through that reasoning?', expression: 'confused' };
    return { message: 'How can the cart’s kinetic energy increase while its mass and speed stay the same?', expression: 'confused' };
  });
  assert.equal(defaultAttempts, 2);
  assert.equal(strategyAttempts, 2);
  assert.equal(result.calls.filter(call => call.name === 'evaluate_learning').length, 1);
  assert.match(result.baseline.message, /kinetic energy/);
  assert.match(result.enhanced.message, /interaction/);
});

test('all eligible reviewed examples reach selection and generation, including other strategies', async () => {
  const catalog = structuredClone(strategies);
  catalog[0].examples.push({ level: 'understand', context: 'Additional reviewed illustration.', question: 'What relationship does the claim describe?', diagnosticPurpose: 'Probe conceptual meaning.' });
  catalog[0].examples.push({ level: 'apply', context: 'A numerical exercise.', question: 'Calculate the result.', diagnosticPurpose: 'Execute a method.' });
  const result = await compareQuestions('inertia', fakeQuery(), undefined, { catalog });
  const expected = strategyExampleContext(catalog.map(strategy => ({ strategy })), 'understand');
  assert.deepEqual(result.exampleContext, expected);
  assert.ok(expected.some(example => example.context === 'Additional reviewed illustration.'));
  const selector = result.calls.find(call => call.name === 'select_strategy');
  assert.deepEqual(JSON.parse(selector.request.messages[0].content).exampleContext, expected);
  const generator = result.calls.find(call => call.branch === 'strategy learner');
  for (const example of expected) assert.ok(generator.request.instructions.includes(JSON.stringify(example)), example.strategyId);
  assert.ok(!generator.request.instructions.includes('A numerical exercise.'));
});

test('every supported level retrieves strategies with matching examples and generation guidance', () => {
  for (const level of ['remember', 'understand', 'apply', 'analyze']) {
    const input = { ...comparisonCases[0], level };
    const candidates = retrieveStrategies({}, input);
    assert.deepEqual(candidates.map(({ strategy }) => strategy.id), strategies.filter(strategy => strategy.levels.includes(level)).map(strategy => strategy.id));
    assert.ok(candidates.length > 0);
    assert.ok(strategyLevelInstructions(level).length > 0);
    const examples = strategyExampleContext(candidates, level);
    for (const { strategy } of candidates) {
      assert.ok(examples.some(example => example.strategyId === strategy.id));
      const context = coreGenerationContext(input, strategy, {});
      assert.ok(context.strategy.constructionRules.includes(strategy.levelGuidance[level]));
    }
    assert.ok(examples.every(example => example.level === level && !('responseSignals' in example)));
  }
});

test('Remember retrieves recall and term clarification without disguising causal strategies as recall', async () => {
  const input = { ...comparisonCases[0], level: 'remember' };
  assert.deepEqual(retrieveStrategies({}, input).map(({ strategy }) => strategy.id).sort(), ['clarify-specific-term', 'recall-specific-element']);
  const selection = await fakeQuery()('', [], { name: 'select_strategy' });
  const forcedCandidates = strategies.map(strategy => ({ strategy }));
  assert.throws(() => validateSelection(selection, forcedCandidates, input), /does not support the active learning level/);
  assert.throws(() => coreGenerationContext(input, strategies.find(strategy => strategy.id === 'remove-condition'), selection.plan), /does not support the active learning level/);
  const recall = { ...selection, strategyId: 'recall-specific-element' };
  assert.equal(validateSelection(recall, retrieveStrategies({}, input), input).id, 'recall-specific-element');
  assert.deepEqual(strategyExampleContext(forcedCandidates, 'remember').map(example => example.strategyId).sort(), ['clarify-specific-term', 'recall-specific-element']);
});

test('new strategy generation retains observable settings and learning type without private response interpretations', async () => {
  const input = comparisonCases[0];
  const { plan } = await fakeQuery()('', [], { name: 'select_strategy' });
  const adapted = { ...plan, scenario: 'An explicit system, interval, and observed transfers.', assumptions: ['No unreported boundary flows.'] };
  const originalIds = new Set(['controlled-comparison', 'boundary-case', 'remove-condition', 'quantity-versus-change', 'reconcile-claims', 'representation-change', 'clarify-specific-term']);
  const additions = strategies.filter(strategy => !originalIds.has(strategy.id) && strategy.levels.includes(input.level));
  assert.ok(additions.length > 0);
  for (const strategy of additions) {
    const context = coreGenerationContext(input, strategy, adapted);
    assert.equal(context.learningType, input.learningType);
    assert.deepEqual(context.setting, { description: adapted.scenario, assumptions: adapted.assumptions });
    assert.equal(context.responseSignals, undefined);
    assert.equal(context.distinctFrom, undefined);
  }
});

test('term clarification cannot replace an Apply or Analyze task', async () => {
  const selection = { ...await fakeQuery()('', [], { name: 'select_strategy' }), strategyId: 'clarify-specific-term' };
  const strategy = strategies.find(item => item.id === selection.strategyId);
  for (const level of ['apply', 'analyze']) {
    const input = { ...comparisonCases[0], level };
    assert.ok(!retrieveStrategies({}, input).some(candidate => candidate.strategy.id === strategy.id));
    assert.throws(() => validateSelection(selection, [{ strategy }], input), /does not support the active learning level/);
  }
});

test('generator excludes full diagnostics, drafted plan, interpretations, and baseline rubric-focus instructions', async () => {
  const fallback = fakeQuery();
  const markers = ['PRIVATE_DIAGNOSTIC_SUMMARY', 'PRIVATE_SELECTION_RATIONALE', 'PRIVATE_DRAFT_QUESTION', 'PRIVATE_PREREQUISITE_REPORT', 'PRIVATE_LIMITATION', 'PRIVATE_RESPONSE_INTERPRETATION'];
  const result = await compareQuestions('inertia', async (instructions, messages, response, options) => {
    const output = await fallback(instructions, messages, response, options);
    if (response.name === 'diagnose_understanding') return { ...output, uncertainty: [markers[0]] };
    if (response.name === 'select_strategy') return { ...output, rationale: markers[1], plan: { ...output.plan, construction: markers[2], prerequisitesSatisfied: markers[3], limitations: [markers[4]], responseSignals: output.plan.responseSignals.map(signal => ({ ...signal, interpretation: markers[5] })) } };
    return output;
  });
  const generator = result.calls.find(call => call.branch === 'strategy learner');
  const checks = result.calls.filter(call => call.name === 'validate_strategy_application');
  for (const marker of markers) assert.ok(!generator.request.instructions.includes(marker), marker);
  assert.ok(checks.some(call => call.request.messages[0].content.includes(markers[2])));
  assert.ok(checks.some(call => call.request.messages[0].content.includes(markers[5])));
  assert.ok(!generator.request.instructions.includes('Learning-type framework'));
  assert.deepEqual(Object.keys(result.generationContext), ['topic', 'level', 'learningType', 'rubricItem', 'studentClaim', 'diagnosticObjective', 'strategy', 'setting']);
  assert.deepEqual(Object.keys(result.generationContext.strategy), ['id', 'title', 'constructionRules']);
});

test('strategy-specific generation fields are included only when needed', () => {
  const input = comparisonCases.find(item => item.id === 'indirect-torque');
  const plan = { targetQuote: input.messages[3].content, rubricItem: input.aspects[0], objective: 'Clarify larger force.', scenario: 'Existing wrench discussion.', assumptions: ['Same hand push'], heldFixed: ['Push'], varied: ['Handle length'], construction: 'Drafted question should not reach generation.', responseSignals: [], limitations: ['Not needed by generation.'] };
  const clarify = coreGenerationContext(input, strategies.find(s => s.id === 'clarify-specific-term'), plan);
  assert.deepEqual(Object.keys(clarify), ['topic', 'level', 'learningType', 'rubricItem', 'studentClaim', 'diagnosticObjective', 'strategy']);
  const comparison = coreGenerationContext(input, strategies.find(s => s.id === 'controlled-comparison'), plan);
  assert.deepEqual(comparison.comparison, { heldFixed: ['Push'], varied: ['Handle length'] });
  assert.equal(comparison.setting, undefined);
  const boundary = coreGenerationContext(input, strategies.find(s => s.id === 'boundary-case'), plan);
  assert.deepEqual(boundary.setting, { description: 'Existing wrench discussion.', assumptions: ['Same hand push'] });
});

test('Understand restrictions apply to planning, generation, and checking but leave the default model unchanged', async () => {
  const fixture = comparisonCases.find(item => item.id === 'ece-parallel-voltage');
  let directInstructions;
  const directQuery = fakeQuery({ caseId: fixture.id });
  await chat(fixture, (instructions, messages, response, options) => {
    if (response.name === 'respond_to_student') directInstructions = instructions;
    return directQuery(instructions, messages, response, options);
  });
  const result = await compareQuestions(fixture.id, fakeQuery({ caseId: fixture.id }));
  const defaultCall = result.calls.find(call => call.branch === 'default learner');
  assert.equal(defaultCall.request.instructions, directInstructions);
  const policy = strategyLevelInstructions('understand');
  assert.ok(!defaultCall.request.instructions.includes(policy));
  for (const call of result.calls.filter(call => ['select_strategy', 'validate_strategy_application'].includes(call.name) || call.branch === 'strategy learner')) assert.ok(call.request.instructions.includes(policy), call.branch);
});

test('Understand numerical question is rejected and replaced with a meaning question', async () => {
  const fallback = fakeQuery({ caseId: 'ece-parallel-voltage' });
  let attempts = 0;
  const result = await compareQuestions('ece-parallel-voltage', async (instructions, messages, response, options) => {
    if (response.name === 'respond_to_student' && instructions.includes('Apply the following diagnostic strategy')) {
      assert.match(instructions, /Do not request numerical results/);
      return { message: ++attempts === 1 ? 'With a 12 V source, what voltage would a voltmeter read across the resistor?' : 'Which two points are you comparing when you describe the voltage across that branch?', expression: 'confused' };
    }
    if (response.name === 'validate_strategy_application') {
      assert.match(instructions, /including simple single-step work and numerical voltmeter readings/);
      const { question } = JSON.parse(messages[0].content);
      return { usable: !question?.includes('voltmeter read'), reason: question?.includes('voltmeter read') ? 'Requests a numerical result at Understand.' : 'Asks about the meaning of branch voltage.' };
    }
    return fallback(instructions, messages, response, options);
  });
  assert.equal(attempts, 2);
  assert.match(result.enhanced.message, /Which two points/);
  assert.equal(result.coverageGap, null);
});

test('Understand numerical plan falls back before question generation', async () => {
  const fallback = fakeQuery({ caseId: 'ece-parallel-voltage' });
  const result = await compareQuestions('ece-parallel-voltage', async (instructions, messages, response, options) => {
    if (response.name === 'select_strategy') {
      const output = await fallback(instructions, messages, response, options);
      return { ...output, plan: { ...output.plan, construction: 'Calculate the voltage by substituting into the formula.' } };
    }
    if (response.name === 'validate_strategy_application') return { usable: false, reason: 'Formula substitution is not permitted at Understand.' };
    return fallback(instructions, messages, response, options);
  });
  assert.equal(result.coverageGap.stage, 'plan_validation');
  assert.equal(result.calls.filter(call => call.name === 'respond_to_student').length, 1);
});

test('confusing longer-handle question is rejected and replaced without changing the default branch', async () => {
  const fallback = fakeQuery({ caseId: 'indirect-torque' });
  const confusing = 'With the same bolt and the same hand push perpendicular to either handle, what does your phrase “larger force” mean for the hand’s push compared with its turning effect about the bolt’s central axis?';
  let attempts = 0;
  const result = await compareQuestions('indirect-torque', async (instructions, messages, response, options) => {
    if (response.name === 'respond_to_student' && instructions.includes('Apply the following diagnostic strategy')) {
      assert.ok(instructions.includes(clearQuestionInstructions));
      return { message: ++attempts === 1 ? confusing : 'You said the hand’s push stays the same. What do you mean by “the force gets larger”?', expression: 'attentive' };
    }
    if (response.name === 'validate_strategy_application') {
      assert.match(instructions, /Judge clarity for this student's demonstrated vocabulary/);
      return { usable: JSON.parse(messages[0].content).question !== confusing, reason: 'Avoid embedded comparisons and unfamiliar terminology.' };
    }
    return fallback(instructions, messages, response, options);
  });
  assert.equal(attempts, 2);
  assert.match(result.enhanced.message, /What do you mean by/);
  assert.ok(!result.calls.find(call => call.branch === 'default learner').request.instructions.includes(clearQuestionInstructions));
});

test('clear strategy questions can include enough context to exceed the former word limit', async () => {
  const fallback = fakeQuery({ caseId: 'indirect-torque' });
  const question = 'You said your hand pushes just as hard when you use the longer handle, but you also said the force gets larger. When you say that the force gets larger, are you describing how hard your hand pushes or how strongly that push turns the bolt?';
  assert.ok(question.split(/\s+/).length > 45);
  let attempts = 0;
  const result = await compareQuestions('indirect-torque', async (instructions, messages, response, options) => {
    if (response.name === 'respond_to_student' && instructions.includes('Apply the following diagnostic strategy')) {
      attempts++;
      assert.ok(instructions.includes('use multiple sentences when helpful'));
      assert.ok(!instructions.includes('one short'));
      return { message: question, expression: 'attentive' };
    }
    if (response.name === 'validate_strategy_application') return { usable: true, reason: 'Familiar wording and context clarify one diagnostic target.' };
    return fallback(instructions, messages, response, options);
  });
  assert.equal(attempts, 1);
  assert.equal(result.enhanced.message, question);
  assert.equal(result.coverageGap, null);
  assert.ok(!result.calls.find(call => call.branch === 'default learner').request.instructions.includes(clearQuestionInstructions));
});
test('diagnostic quotes cannot credit assistant text', async () => {
  await assert.rejects(compareQuestions('inertia', fakeQuery({ invalidEvidence: true })), /Diagnostic evidence/);
});
test('invalid case fails before any model call', async () => {
  await assert.rejects(compareQuestions('__proto__', () => { throw new Error('should not run'); }), /valid comparison case/);
});
test('completion is reported without manufacturing a question', async () => {
  const result = await compareQuestions('inertia', fakeQuery({ complete: true }));
  assert.equal(result.enhanced, null);
  assert.match(result.notice, /completed/);
});
test('catalog retrieval uses review and level eligibility, not equal/unequal topic words', () => {
  const mechanical = retrieveStrategies({ diagnosticObjective: 'force equal unequal' }, comparisonCases[0]);
  const electrical = retrieveStrategies({ diagnosticObjective: 'voltage equal unequal' }, comparisonCases.find(item => item.id === 'ece-parallel-voltage'));
  assert.deepEqual(mechanical.map(c => c.strategy.id), electrical.map(c => c.strategy.id));
  assert.ok(mechanical.every(c => c.score === undefined));
  const catalog = [{ ...strategies[0], reviewStatus: 'draft' }, { ...strategies[1], levels: ['analyze'] }];
  assert.deepEqual(retrieveStrategies({}, comparisonCases[0], catalog), []);
});

test('indirect fixtures remain valid fixed transcripts with the expanded strategy corpus', () => {
  assert.equal(comparisonCases.filter(item => item.group === 'FCI Direct Test').length, 6);
  const indirect = comparisonCases.filter(item => item.group === 'FCI Indirect Test');
  assert.equal(indirect.length, 6);
  assert.equal(new Set(comparisonCases.map(item => item.id)).size, comparisonCases.length);
  assert.ok(strategies.some(strategy => strategy.id === 'conservation-accounting'));
  for (const input of indirect) {
    assert.doesNotThrow(() => validate(input));
    assert.deepEqual(input.messages.map(item => item.role), ['assistant', 'user', 'assistant', 'user']);
    const candidates = retrieveStrategies({}, input);
    assert.ok(candidates.length > 0, input.id);
    assert.ok(candidates.every(candidate => strategies.includes(candidate.strategy)));
  }
});

test('ECE folder retains four valid electrical fixtures with the expanded strategy corpus', () => {
  const ece = comparisonCases.filter(item => item.group.toLowerCase() === 'ece indirect test');
  assert.equal(ece.length, 4);
  assert.equal(new Set(comparisonCases.map(item => item.id)).size, comparisonCases.length);
  assert.ok(strategies.some(strategy => strategy.id === 'necessary-sufficient'));
  for (const input of ece) {
    assert.doesNotThrow(() => validate(input));
    assert.equal(input.level, 'understand');
    assert.deepEqual(input.messages.map(item => item.role), ['assistant', 'user', 'assistant', 'user']);
    assert.ok(retrieveStrategies({}, input).every(candidate => strategies.includes(candidate.strategy)));
  }
});

test('selector abstention reuses the rubric question and records the coverage gap', async () => {
  const fallback = fakeQuery({ caseId: 'ece-parallel-voltage' });
  const result = await compareQuestions('ece-parallel-voltage', (instructions, messages, response, options) => response.name === 'select_strategy'
    ? { strategyId: 'none', rationale: 'No safe diagnostic application with available prerequisites.', plan: null }
    : fallback(instructions, messages, response, options));
  assert.equal(result.strategy, null);
  assert.equal(result.questionPlan, null);
  assert.equal(result.enhanced.message, result.baseline.message);
  assert.equal(result.enhanced.fallback, true);
  assert.equal(result.coverageGap.stage, 'selection');
  assert.equal(result.calls.filter(call => call.name === 'respond_to_student').length, 1);
  assert.ok(result.calls.some(call => call.name === 'strategy_coverage_gap'));
});

test('no reviewed catalog records triggers rubric fallback without manufacturing retrieval candidates', async () => {
  const catalog = strategies.map(strategy => ({ ...strategy, reviewStatus: 'draft' }));
  const result = await compareQuestions('inertia', fakeQuery(), undefined, { catalog });
  assert.equal(result.coverageGap.stage, 'retrieval');
  assert.deepEqual(result.candidates, []);
  assert.equal(result.enhanced.message, result.baseline.message);
  assert.ok(!result.calls.some(call => call.name === 'select_strategy'));
});

test('a controlled comparison without a changed condition is rejected before generation', async () => {
  const fallback = fakeQuery();
  const result = await compareQuestions('inertia', async (instructions, messages, response, options) => {
    const output = await fallback(instructions, messages, response, options);
    return response.name === 'select_strategy' ? { ...output, strategyId: 'controlled-comparison', plan: { ...output.plan, varied: [] } } : output;
  });
  assert.equal(result.coverageGap.stage, 'selection');
  assert.match(result.coverageGap.reason, /named change/);
  assert.equal(result.calls.filter(call => call.name === 'respond_to_student').length, 1);
});

test('a manufactured database ID cannot become an applied strategy', async () => {
  const fallback = fakeQuery();
  const result = await compareQuestions('inertia', (instructions, messages, response, options) => response.name === 'select_strategy'
    ? { strategyId: 'made-up-match', rationale: 'Claims a match.', plan: {} }
    : fallback(instructions, messages, response, options));
  assert.equal(result.strategy, null);
  assert.equal(result.coverageGap.stage, 'selection');
  assert.match(result.coverageGap.reason, /never manufacture/);
});

test('unusable adapted plan falls back before any strategy question is generated', async () => {
  const fallback = fakeQuery();
  const result = await compareQuestions('inertia', (instructions, messages, response, options) => response.name === 'validate_strategy_application'
    ? { usable: false, reason: 'The plan imports an unrelated assumption.' }
    : fallback(instructions, messages, response, options));
  assert.equal(result.coverageGap.stage, 'plan_validation');
  assert.equal(result.calls.filter(call => call.name === 'respond_to_student').length, 1);
});

test('persistent semantic question rejection cannot publish a false strategy application', async () => {
  const fallback = fakeQuery();
  const result = await compareQuestions('inertia', (instructions, messages, response, options) => response.name === 'validate_strategy_application'
    ? { usable: !JSON.parse(messages[0].content).question, reason: 'Generated question does not implement the plan.' }
    : fallback(instructions, messages, response, options));
  assert.equal(result.coverageGap.stage, 'question_validation');
  assert.equal(result.enhanced.message, result.baseline.message);
  assert.equal(result.strategy, null);
});

test('every comparison uses its saved level-pipeline rubric without runtime regeneration', () => {
  const saved = JSON.parse(readFileSync(new URL('../comparison-rubrics.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(saved.cases).length, comparisonCases.length);
  for (const fixture of comparisonCases) {
    const record = saved.cases[fixture.id];
    assert.deepEqual(fixture.aspects, fixture.reviewedRubricItems || record.items);
    if (fixture.reviewedRubricItems) assert.deepEqual(fixture.rubricGeneration.generatedItems, record.items);
    assert.deepEqual(record.input, { topic: fixture.topic, level: fixture.level, learningType: fixture.learningType });
    assert.equal(fixture.rubricGeneration.pipeline, 'generateLevelRubric');
    assert.equal(fixture.rubricGeneration.endpoint, '/api/developer/rubric');
    assert.match(fixture.rubricGeneration.promptVersion, /^[a-f0-9]{64}$/);
    assert.ok(Number.isFinite(Date.parse(fixture.rubricGeneration.generatedAt)));
    assert.doesNotThrow(() => validate(fixture));
  }
});

test('coverage fixtures exercise every eligible strategy-level pair and do not leak benchmark expectations', async () => {
  const coverage = comparisonCases.filter(item => item.expectedStrategyId);
  const expected = strategies.flatMap(strategy => strategy.levels.map(level => `${strategy.id}:${level}`)).sort();
  assert.equal(coverage.length, 51);
  assert.deepEqual(coverage.map(item => `${item.expectedStrategyId}:${item.level}`).sort(), expected);
  for (const fixture of coverage) {
    assert.doesNotThrow(() => validate(fixture));
    const base = fakeQuery({ caseId: fixture.id });
    const result = await compareQuestions(fixture.id, async (instructions, messages, response, options) => {
      const value = await base(instructions, messages, response, options);
      return response.name === 'select_strategy' ? { ...value, strategyId: fixture.expectedStrategyId } : value;
    });
    assert.equal(result.comparisonMode, 'targeted');
    assert.equal(result.strategy.id, fixture.expectedStrategyId);
    assert.deepEqual(result.candidates.map(({ strategy }) => strategy.id), [fixture.expectedStrategyId]);
    for (const call of result.calls.filter(item => ['diagnose_understanding', 'select_strategy'].includes(item.name))) {
      const { input } = JSON.parse(call.request.messages[0].content);
      assert.equal(input.expectedStrategyId, undefined);
      assert.equal(input.reviewGuide, undefined);
      assert.equal(input.title, undefined);
    }
  }
});

test('targeted comparisons preserve abstention rather than forcing the expected strategy', async () => {
  const fixture = comparisonCases.find(item => item.expectedStrategyId === 'recall-specific-element');
  const base = fakeQuery({ caseId: fixture.id });
  const result = await compareQuestions(fixture.id, (instructions, messages, response, options) => response.name === 'select_strategy'
    ? { strategyId: 'none', rationale: 'The target cannot be safely instantiated.', plan: null }
    : base(instructions, messages, response, options));
  assert.equal(result.comparisonMode, 'targeted');
  assert.equal(result.enhanced.fallback, true);
  assert.equal(result.strategy, null);
  assert.equal(result.coverageGap.stage, 'selection');
});

async function invoke(server, { method = 'GET', body, hosted = false } = {}) {
  // Authenticate only this isolated in-memory test server, never the running app.
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method, url: '/api/developer/question-comparison', socket: { remoteAddress: '127.0.0.1' }, headers: { authorization: testAuthorization, host: hosted ? 'preview.vercel.app' : 'localhost:3001', origin: hosted ? 'https://preview.vercel.app' : 'http://localhost:5173', 'content-type': 'application/json' } });
  return new Promise(resolve => server.emit('request', req, { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); } }));
}
test('local comparison API lists fixed cases without a provider and returns versioned paired results', async t => {
  const server = createApiServer({ accountService: testAccountService(), chatgpt: null, env: { ANTHROPIC_API_KEY: 'test-only' }, query: fakeQuery() });
  t.after(() => server.close());
  const listed = await invoke(server);
  assert.equal(listed.status, 200);
  assert.equal(listed.data.cases.length, 67);
  assert.deepEqual(listed.data.cases[0].messages, comparisonCases[0].messages);
  assert.equal((await invoke(server, { method: 'POST', body: { caseId: 'not-real' } })).status, 400);
  const generated = await invoke(server, { method: 'POST', body: { caseId: 'inertia', messages: [] } });
  assert.equal(generated.status, 200);
  assert.deepEqual(generated.data.case.messages, comparisonCases[0].messages);
  assert.ok(generated.data.runId);
  assert.match(generated.data.promptVersion, /^[a-f0-9]{64}$/);
  assert.equal(generated.data.provider, 'anthropic');
});
test('comparison generation requires configured provider and developer endpoint is blocked on hosted deployments', async t => {
  const local = createApiServer({ accountService: testAccountService(), chatgpt: null, env: {}, query: () => { throw new Error('must not run'); } });
  const hosted = createApiServer({ accountService: testAccountService(), hosted: true, env: { VERCEL_URL: 'preview.vercel.app' } });
  t.after(() => { local.close(); hosted.close(); });
  assert.equal((await invoke(local)).status, 200);
  assert.equal((await invoke(local, { method: 'POST', body: { caseId: 'inertia' } })).status, 503);
  assert.equal((await invoke(hosted, { hosted: true })).status, 403);
});


test('solution leaks and factive claims retry in both branches despite a permissive checker', async () => {
  const fallback = fakeQuery();
  let baselineAttempts = 0, enhancedAttempts = 0;
  const result = await compareQuestions('inertia', async (instructions, messages, response, options) => {
    if (response.name === 'select_strategy') assert.match(instructions, /Keep the scenario and construction free of solution scaffolding/);
    if (response.name !== 'respond_to_student') return fallback(instructions, messages, response, options);
    if (instructions.includes('Apply the following diagnostic strategy')) {
      if (++enhancedAttempts === 1) return { message: 'The relationship is F = ma. What happens after contact ends?', expression: 'confused' };
      return { message: 'On a frictionless surface, what happens to the puck after the push ends?', expression: 'confused' };
    }
    if (++baselineAttempts === 1) return { message: 'Why does contact ending establish that the puck must stop?', expression: 'confused' };
    assert.match(instructions, /presupposes a disputed implication/);
    return { message: 'What makes you think the puck must stop after contact ends?', expression: 'confused' };
  });
  assert.equal(baselineAttempts, 2);
  assert.equal(enhancedAttempts, 2);
  assert.equal(result.coverageGap, null);
  assert.doesNotMatch(result.enhanced.message, /F = ma/);
});

// Preserve regression coverage for the original developer-comparison baseline.
function chat(input, query, prompts) { return conversationChat(input, query, prompts, { evaluator: 'legacy', learner: 'default' }); }
