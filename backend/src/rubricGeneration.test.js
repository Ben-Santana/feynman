import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRubric } from './chat.js';
import { generateRubricBatches } from '../../frontend/src/rubricGeneration.ts';

const rubric = { remember: 'Identify the concept.', understand: '', apply: '', analyze: '' };
const concepts = count => Array.from({ length: count }, (_, index) => ({ name: `Concept ${index + 1}`, target: 'remember' }));
const generated = batch => batch.map(({ name }) => ({ name, rubric: { ...rubric } }));

test('17 concepts use four sequential API calls with the cumulative rubric', async () => {
  const requested = concepts(17);
  const completed = [];
  const sizes = [];
  let active = false;
  const result = await generateRubricBatches(requested, async (batch, previousRubric) => {
    assert.equal(active, false);
    active = true;
    assert.deepEqual(previousRubric, completed);
    sizes.push(batch.length);
    await Promise.resolve();
    const response = generated(batch);
    completed.push(...response);
    active = false;
    return { concepts: response };
  });
  assert.deepEqual(sizes, [5, 5, 5, 2]);
  assert.deepEqual(result, generated(requested));
});

test('five or fewer concepts use one API call, and a failed batch stops generation', async () => {
  for (const count of [1, 5, 6]) {
    let calls = 0;
    await generateRubricBatches(concepts(count), async batch => {
      calls++;
      return { concepts: generated(batch) };
    });
    assert.equal(calls, Math.ceil(count / 5));
  }
  let calls = 0;
  await assert.rejects(generateRubricBatches(concepts(17), async batch => {
    if (++calls === 2) throw new Error('Provider failed');
    return { concepts: generated(batch) };
  }), /Provider failed/);
  assert.equal(calls, 2);
  await assert.rejects(generateRubricBatches(concepts(6), async () => ({ concepts: [] })), /complete rubric/);
});

test('direct API generation also caps model calls at five and retains source context', async () => {
  const requested = concepts(17);
  const completed = [];
  const sizes = [];
  const file = { name: 'source.txt', type: 'text/plain', data: Buffer.from('Source material').toString('base64') };
  const result = await generateRubric({ concepts: requested, files: [file], learningType: 'design', additionalInstructions: 'Use practical examples.' }, async (system, messages, responseTool) => {
    const request = JSON.parse(messages[0].content[0].text);
    assert.deepEqual(request.previousRubric ?? [], completed);
    assert.equal(request.additionalInstructions, 'Use practical examples.');
    assert.match(system, /Design \/ Project-Based/);
    assert.match(JSON.stringify(messages), /Source material/);
    if (completed.length) assert.match(system, /do not repeat or revise/);
    assert.equal(responseTool.schema.properties.concepts.maxItems, request.concepts.length);
    sizes.push(request.concepts.length);
    const response = generated(request.concepts);
    completed.push(...response);
    return { concepts: response };
  });
  assert.deepEqual(sizes, [5, 5, 5, 2]);
  assert.deepEqual(result, generated(requested));
});

test('API uses the supplied previous rubric only as context and rejects malformed context', async () => {
  const previousRubric = generated(concepts(5));
  const requested = [{ name: 'Next concept', target: 'remember' }];
  const result = await generateRubric({ concepts: requested, previousRubric }, async (_system, messages) => {
    assert.deepEqual(JSON.parse(messages[0].content[0].text).previousRubric, previousRubric);
    return { concepts: generated(requested) };
  });
  assert.deepEqual(result, generated(requested));
  for (const invalid of ['invalid', [{}], [{ name: 'Concept', rubric: { remember: 42 } }]]) {
    await assert.rejects(generateRubric({ concepts: requested, previousRubric: invalid }, async () => assert.fail('Invalid context must not call the model')), /valid previously generated rubric/);
  }
});
