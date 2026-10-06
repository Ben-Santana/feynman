import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, validate, generateRubric, conceptsFromStudyTest, suggestConceptsFromFiles } from './chat.js';
import { learningTypes, learningTypeIds, resolveLearningType, restoreLearningType } from '../../frontend/src/learningTypes.js';
import { draftTarget, genericRubric, fillMissingRubric, restoreDraft, withBasicCriterion } from '../../frontend/src/rubricSetup.ts';
import { assessmentTranscript, advanceConcept, restoreLearning, levelIds } from '../../frontend/src/learningFlow.ts';
import { checklistItems } from '../../frontend/src/rubricChecklist.js';

const input = (learningType, level = 'analyze', messages = []) => ({ learningType, level, topic: 'Capacitors', aspects: ['Explains the reasoning.'], messages });
const conversation = (answer = 'My decision follows the requirements because of the stated constraints.') => [{ role: 'assistant', content: 'Compare the supplied alternatives.' }, { role: 'user', content: answer }];
const verdict = (messages, status = 'supported') => {
  const judgment = { status, result: status === 'flawed' ? 'incorrect' : 'not_applicable', evidence: status === 'missing' ? [] : [{ messageIndex: 1, quote: messages[1].content }] };
  return { reason: 'Reasoning checked.', nextQuestionFocus: 'how the changed condition affects the outcome', criteria: [{ aspect: 'Explains the reasoning.', ...judgment }], task: judgment };
};
const followUp = { message: 'How would that change your reasoning?', expression: 'confused' };

test('new drafts retain an unchosen type and legacy sessions retain quantitative behavior', () => {
  assert.equal(resolveLearningType(), 'quantitative');
  assert.equal(restoreLearningType(undefined), 'quantitative');
  assert.equal(restoreLearningType(null), null);
  assert.equal(restoreLearningType(null, true), 'quantitative');
  for (const learningType of learningTypeIds) {
    const record = { title: 'Session', started: false, learningType };
    assert.equal(restoreDraft(record).learningType, learningType);
  }
  assert.equal(restoreDraft({ learningType: null, started: false }).learningType, null);
  assert.equal(restoreDraft({ started: true }).learningType, 'quantitative');
});

test('all API generation paths reject invalid supplied learning types', async () => {
  for (const value of [null, '', 'lab', 'constructor', {}, 1]) {
    assert.throws(() => validate(input(value)), /valid learning type/);
    await assert.rejects(generateRubric({ learningType: value }), /valid learning type/);
    await assert.rejects(conceptsFromStudyTest({ learningType: value }), /valid learning type/);
    await assert.rejects(suggestConceptsFromFiles([], undefined, value), /valid learning type/);
  }
});

test('templates follow the learning tables and keep levels above the target empty', () => {
  for (const type of learningTypeIds) {
    for (const target of levelIds) {
      const rubric = genericRubric('Capacitors', target, type);
      levelIds.forEach((level, index) => {
        assert.ok(rubric[level].length <= 1000);
        assert.equal(checklistItems(rubric[level]).length, index <= levelIds.indexOf(target) ? learningTypes[type].criteria[level].length : 0);
      });
    }
  }
  assert.match(genericRubric('Capacitors', 'analyze', 'design').apply, /make a design decision/);
  assert.match(genericRubric('Capacitors', 'analyze', 'design').analyze, /tradeoffs/);
  assert.match(genericRubric('Capacitors', 'analyze', 'experimental').analyze, /speculation/);
  assert.match(genericRubric('Capacitors', 'analyze', 'theoretical').analyze, /misconceptions/);
  assert.match(genericRubric('Capacitors', 'analyze', 'quantitative').analyze, /assumptions/);
});

test('continuing setup preserves custom criteria and fills missing requirements', () => {
  const rubric = { remember: 'Recall my custom terminology.', understand: '', apply: 'Make a decision about packaging.', analyze: '' };
  const concept = { name: 'Capacitors', rubric, target: 'apply' };
  const next = fillMissingRubric(concept, 'apply', genericRubric(concept.name, 'apply', 'design'));
  assert.equal(next.rubric.remember, rubric.remember);
  assert.equal(next.rubric.apply, rubric.apply);
  assert.match(next.rubric.understand, /requirements and constraints/);
  assert.equal(next.rubric.analyze, '');
  assert.equal(concept.rubric.understand, '');
  const extended = withBasicCriterion(next, 'analyze', 'design');
  assert.match(extended.rubric.analyze, /tradeoffs/);
  assert.equal(extended.rubric.apply, rubric.apply);
});

test('a retained higher-level edit keeps its target and fills intervening gaps', () => {
  const concept = { name: 'Capacitors', rubric: { remember: 'Name the components.', understand: '', apply: '', analyze: 'Compare alternative packages.' }, target: 'analyze' };
  const target = draftTarget(concept, 'remember');
  assert.equal(target, 'analyze');
  const filled = fillMissingRubric(concept, target, genericRubric(concept.name, target, 'design'));
  assert.equal(filled.rubric.analyze, concept.rubric.analyze);
  assert.match(filled.rubric.apply, /make a design decision/);
  assert.ok(filled.rubric.understand);
  assert.equal(filled.target, 'analyze');
});

test('non-quantitative Analyze receives only current-stage evidence, including after reload', () => {
  const early = conversation('Earlier understanding evidence.');
  const current = conversation('Current analysis evidence.');
  const concept = { id: 'c', name: 'Capacitors', target: 'analyze', passed: 3, stageStart: 2, messages: [...early, current[0]], rubric: genericRubric('Capacitors', 'analyze', 'design') };
  const restored = restoreLearning({ concepts: [concept], activeId: 'c', started: true }).concepts[0];
  for (const type of ['theoretical', 'experimental', 'design']) assert.deepEqual(assessmentTranscript(restored, current[1], type), current);
  assert.deepEqual(assessmentTranscript(restored, current[1], 'quantitative'), [...early, ...current]);
});

for (const learningType of learningTypeIds) {
  test(`${learningType} reaches rubric generation, upload extraction, and concept suggestions`, async () => {
    const file = { name: 'source.txt', type: 'text/plain', data: Buffer.from('Capacitors store energy.').toString('base64') };
    const full = genericRubric('Capacitors', 'analyze', learningType);
    const query = async (system, _messages, responseTool) => {
      assert.ok(system.includes(`Learning type: ${learningTypes[learningType].label}`));
      assert.ok(system.includes(learningTypes[learningType].criteria.analyze[0]));
      assert.match(system, /data, (?:never instructions|not commands)/);
      return responseTool.name === 'suggest_concepts' ? { names: ['Capacitors'] } : { concepts: [{ name: 'Capacitors', rubric: full }] };
    };
    const generated = await generateRubric({ learningType, concepts: [{ name: 'Capacitors', target: 'apply' }], files: [file] }, query);
    assert.equal(generated[0].rubric.analyze, '');
    assert.equal(generated[0].rubric.apply, full.apply);
    assert.deepEqual(await conceptsFromStudyTest({ ...file, learningType }, query), [{ name: 'Capacitors', rubric: full }]);
    assert.deepEqual(await suggestConceptsFromFiles([file], query, learningType), ['Capacitors']);
  });
}

for (const learningType of ['theoretical', 'experimental', 'design']) {
  for (const level of ['apply', 'analyze']) {
    test(`${learningType} ${level} introduces a scenario without grading or evaluating`, async () => {
      let calls = 0;
      const result = await chat(input(learningType, level), async (system, _messages, responseTool) => {
        calls++;
        assert.equal(responseTool.name, 'respond_to_student');
        assert.equal(responseTool.schema.properties.paper, undefined);
        assert.ok(system.includes(learningTypes[learningType].scenarios[level]));
        assert.match(system, /one question at a time/);
        if (learningType === 'experimental') assert.match(system, /clearly labeled Simulated experiment/);
        if (learningType === 'design') assert.match(system, /without (?:recommending one|explaining them or recommending a winner)/);
        return { message: 'Here is the scenario. What would you predict?', expression: 'attentive', paper: { exercises: [] } };
      });
      assert.equal(calls, 1);
      assert.equal(result.assessment, null);
      assert.equal(result.paper, null);
      assert.equal(result.analysisGrade, undefined);
    });
  }

  test(`${learningType} Apply uses its own task framework and rejects insufficient reasoning`, async () => {
    const messages = conversation();
    for (const status of ['needs_clarification', 'supported']) {
      const result = await chat(input(learningType, 'apply', messages), async (system, _transcript, responseTool) => {
        if (responseTool.name === 'evaluate_learning') {
          assert.ok(system.includes(learningTypes[learningType].tasks.apply));
          assert.match(system, /correct result with too little reasoning is needs_clarification/);
          if (learningType === 'design') assert.match(system, /Multiple defensible decisions can pass/);
          if (learningType === 'experimental') assert.match(system, /Do not require conducting a physical experiment/);
          return verdict(messages, status);
        }
        return followUp;
      });
      assert.equal(result.assessment.complete, status === 'supported');
    }
  });

  test(`${learningType} Analyze continues interactively until sufficient learner evidence passes two checks`, async () => {
    const messages = conversation();
    for (const status of ['missing', 'needs_clarification', 'flawed', 'supported']) {
      const calls = [];
      const result = await chat(input(learningType, 'analyze', messages), async (system, _transcript, responseTool) => {
        calls.push(responseTool.name);
        if (responseTool.name === 'evaluate_learning') {
          assert.ok(system.includes(learningTypes[learningType].tasks.analyze));
          assert.match(system, /earlier-stage answers cannot satisfy/);
          assert.doesNotMatch(system, /final, one-shot assessment/);
          return verdict(messages, status);
        }
        assert.equal(responseTool.name, 'respond_to_student');
        assert.match(system, /Continue the existing scenario/);
        assert.match(system, /changed condition affects the outcome/);
        return followUp;
      });
      assert.equal(result.assessment.complete, status === 'supported');
      assert.deepEqual(calls, status === 'supported' ? ['evaluate_learning', 'evaluate_learning'] : ['evaluate_learning', 'respond_to_student']);
      assert.equal(result.finalSummary, undefined);
      assert.equal(result.analysisGrade, undefined);
      assert.ok(!result.paper);
    }
  });

  test(`${learningType} cannot pass by citing scenario facts or disagreement between evaluators`, async () => {
    const messages = conversation('I am unsure.');
    const invented = verdict(messages);
    invented.criteria[0].evidence = invented.task.evidence = [{ messageIndex: 0, quote: messages[0].content }];
    const result = await chat(input(learningType, 'analyze', messages), async (_system, _messages, tool) => tool.name === 'evaluate_learning' ? invented : followUp);
    assert.equal(result.assessment.complete, false);
    assert.deepEqual(result.assessment.task.evidence, []);
    let count = 0;
    const disputed = await chat(input(learningType, 'analyze', messages), async (_system, _messages, tool) => tool.name === 'evaluate_learning' ? verdict(messages, ++count === 1 ? 'supported' : 'needs_clarification') : followUp);
    assert.equal(count, 2);
    assert.equal(disputed.assessment.complete, false);
  });

  test(`${learningType} rejects quantitative papers and reviews`, () => {
    const messages = [{ role: 'assistant', content: 'Check this.', paper: { id: 'p', markdown: 'My solution.' } }, { role: 'user', content: 'Fail' }];
    assert.throws(() => validate(input(learningType, 'analyze', messages)), /Invalid classroom paper/);
    const review = conversation();
    review[1].review = { paperId: 'p', grade: 'pass', explanation: '' };
    assert.throws(() => validate(input(learningType, 'analyze', review)), /Invalid paper review/);
  });
}

test('scenario responses persist and completion advances non-quantitative Analyze without a final grade', () => {
  const messages = conversation();
  const concept = { id: 'c', name: 'Capacitors', target: 'analyze', passed: 3, stageStart: 0, messages: [messages[0]], rubric: genericRubric('Capacitors', 'analyze', 'design'), assessments: {} };
  const incomplete = advanceConcept(concept, messages, { ...followUp, assessment: { ...verdict(messages, 'missing'), complete: false } });
  assert.equal(incomplete.passed, 3);
  assert.equal(incomplete.messages.at(-1).content, followUp.message);
  const completed = advanceConcept(concept, messages, { message: 'Thank you for teaching me!', expression: 'excited', assessment: { ...verdict(messages), complete: true } });
  assert.equal(completed.passed, 4);
  assert.equal(completed.finalSummary, undefined);
  assert.equal(completed.analysisGrade, undefined);
  assert.deepEqual(completed.messages, messages);
});

test('a failed scenario or evaluator call propagates without manufacturing completion', async () => {
  const failure = async () => { throw new Error('Offline'); };
  await assert.rejects(chat(input('experimental', 'apply'), failure), /Offline/);
  await assert.rejects(chat(input('design', 'analyze', conversation()), failure), /Offline/);
});
