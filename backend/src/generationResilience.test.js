import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, generateRubric, generateLevelRubric, validate } from './chat.js';
import { AIError, createProviderQuery, LanguageModelProvider } from './providers/LanguageModelProvider.js';
import { generateRubricBatches } from '../../frontend/src/rubricGeneration.ts';

const concepts = [{ name: 'Energy', target: 'remember' }, { name: 'Charge', target: 'remember' }];
const rubric = { remember: ['Identifies the quantity.'], understand: [], apply: [], analyze: [] };
const valid = () => ({ concepts: concepts.map(({ name }) => ({ name, rubric: structuredClone(rubric) })) });
const input = { level: 'remember', topic: 'Circuits', aspects: ['Energy', 'Charge'], messages: [{ role: 'assistant', content: 'Teach me.' }, { role: 'user', content: 'Energy and charge are conserved.' }] };
const judgment = { status: 'supported', result: 'correct', evidence: [{ messageIndex: 1, quote: 'Energy and charge are conserved.' }] };
const verdict = () => ({ reason: 'Checked.', criteria: input.aspects.map(aspect => ({ aspect, ...structuredClone(judgment) })), task: structuredClone(judgment) });

test('rubric output retries once with repair guidance and a shared deadline', async () => {
  const signals = [];
  let calls = 0;
  const result = await generateRubric({ concepts }, async (system, _messages, _tool, options) => {
    signals.push(options.signal);
    if (++calls === 1) return { concepts: [null] };
    assert.match(system, /previous response could not be validated/);
    return valid();
  });
  assert.equal(calls, 2);
  assert.equal(signals[0], signals[1]);
  assert.equal(result[0].rubric.remember, '1. Identifies the quantity.');
});

test('reordered rubric and assessment results are matched by exact names', async () => {
  const result = await generateRubric({ concepts }, async () => ({ concepts: valid().concepts.reverse() }));
  assert.deepEqual(result.map(item => item.name), ['Energy', 'Charge']);
  const assessed = await chat(input, async () => ({ ...verdict(), criteria: verdict().criteria.reverse() }));
  assert.deepEqual(assessed.assessment.criteria.map(item => item.aspect), input.aspects);
  assert.equal(assessed.assessment.complete, true);
});

test('malformed assessment recovers before the independent completion check', async () => {
  let calls = 0;
  const result = await chat(input, async (system, _messages, tool) => {
    assert.equal(tool.schema.properties.criteria.minItems, 2);
    assert.deepEqual(tool.schema.properties.criteria.items.properties.aspect.enum, input.aspects);
    if (++calls === 1) return { ...verdict(), criteria: [null, null] };
    if (calls === 2) assert.match(system, /previous response could not be validated/);
    return verdict();
  });
  assert.equal(calls, 3);
  assert.equal(result.assessment.complete, true);
});

test('persistent invalid assessments fail after two attempts without manufacturing completion', async () => {
  let calls = 0;
  await assert.rejects(chat(input, async (_system, _messages, tool) => {
    assert.equal(tool.name, 'evaluate_learning');
    calls++;
    return { ...verdict(), criteria: [null, null] };
  }), /Invalid assessment response/);
  assert.equal(calls, 2);
});

test('authentication, rate limits, cancellation and transport errors are not retried', async () => {
  for (const error of [new AIError('Expired', 401), new AIError('Rate limited', 429), new AIError('Timeout', 504), new Error('Connection failed')]) {
    let calls = 0;
    await assert.rejects(generateRubric({ concepts }, async () => { calls++; throw error; }), value => value === error);
    assert.equal(calls, 1);
  }
});

test('invalid provider objects can recover through the common provider boundary', async () => {
  let calls = 0;
  class Provider extends LanguageModelProvider {
    static metadata = { label: 'Test', capabilities: {} };
    async generateStructured() { return ++calls === 1 ? null : { items: ['Identifies charge.'] }; }
  }
  const result = await generateLevelRubric({ topic: 'Charge', level: 'remember' }, createProviderQuery(new Provider()));
  assert.equal(calls, 2);
  assert.deepEqual(result.items, ['Identifies charge.']);
});

test('null conversation entries and invalid file lists fail before inference', async () => {
  assert.throws(() => validate({ ...input, messages: [null] }), /Invalid conversation/);
  for (const files of [{}, 'files', [null]]) {
    await assert.rejects(generateRubric({ concepts, files }, () => assert.fail('No model call')), /Upload/);
  }
});

test('browser batching rejects null and unusable rubrics before advancing progress', async () => {
  for (const result of [{ concepts: [null] }, { concepts: [{ name: 'Energy' }] }, { concepts: [{ name: 'Energy', rubric: { remember: '', understand: '', apply: '', analyze: '' } }] }]) {
    await assert.rejects(generateRubricBatches(concepts.slice(0, 1), async () => result, () => assert.fail('No progress on an invalid batch')), /complete rubric/);
  }
});

test('repairing a later batch does not repeat earlier successful generation', async () => {
  const requested = Array.from({ length: 6 }, (_, i) => ({ name: `Concept ${i}`, target: 'remember' }));
  const batches = [];
  const result = await generateRubric({ concepts: requested }, async (_system, messages) => {
    const batch = JSON.parse(messages[0].content[0].text).concepts;
    batches.push(batch.length);
    if (batches.length === 2) return {};
    return { concepts: batch.map(({ name }) => ({ name, rubric: structuredClone(rubric) })) };
  });
  assert.deepEqual(batches, [5, 1, 1]);
  assert.equal(result.length, 6);
});

test('a malformed classmate reply is retried without reevaluating the learner', async () => {
  let evaluations = 0;
  let replies = 0;
  const result = await chat(input, async (_system, _messages, tool) => {
    if (tool.name === 'evaluate_learning') {
      evaluations++;
      return { ...verdict(), criteria: verdict().criteria.map(item => ({ ...item, status: 'needs_clarification' })) };
    }
    if (++replies === 1) return null;
    return { message: 'How does charge flow?', expression: 'attentive' };
  });
  assert.equal(evaluations, 1);
  assert.equal(replies, 2);
  assert.equal(result.assessment.complete, false);
});

test('duplicate requested criteria preserve their individual judgments', async () => {
  const request = { ...input, aspects: ['Charge', 'Charge'] };
  const criteria = [{ aspect: 'Charge', ...structuredClone(judgment) }, { aspect: 'Charge', ...structuredClone(judgment), status: 'missing', evidence: [] }];
  const result = await chat(request, async (_system, _messages, tool) => tool.name === 'evaluate_learning'
    ? { ...verdict(), criteria }
    : { message: 'Could you explain that?', expression: 'attentive' });
  assert.equal(result.assessment.complete, false);
  assert.deepEqual(result.assessment.criteria.map(item => item.status), ['supported', 'missing']);
});

test('large supplied context stays bounded while direct API batches progress', async () => {
  const requested = Array.from({ length: 6 }, (_, i) => ({ name: `New ${i}`, target: 'remember' }));
  const previousRubric = Array.from({ length: 20 }, (_, i) => ({ name: `Old ${i}`, rubric: { remember: 'Identify it.', understand: '', apply: '', analyze: '' } }));
  const result = await generateRubric({ concepts: requested, previousRubric }, async (_system, messages) => {
    const request = JSON.parse(messages[0].content[0].text);
    assert.equal(request.previousRubric.length, 20);
    return { concepts: request.concepts.map(({ name }) => ({ name, rubric: structuredClone(rubric) })) };
  });
  assert.equal(result.length, 6);
});
