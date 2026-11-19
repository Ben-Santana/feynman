import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRubric } from './chat.js';
import { InvalidOutputError } from './structuredOutput.js';

const long = n => `Explains ${'how energy moves through the system '.repeat(4)}case ${n}.`;
const rubric = items => ({ remember: items, understand: items, apply: [], analyze: [] });

test('rubric generation keeps the leading items that fit when a level runs over 1,000 characters', async () => {
  const items = Array.from({ length: 8 }, (_, i) => long(i + 1));
  const [concept] = await generateRubric({ concepts: [{ name: 'Energy', target: 'understand' }] }, async (system, messages, responseTool) => {
    const level = responseTool.schema.properties.concepts.items.properties.rubric.properties.remember;
    assert.match(JSON.stringify(level), /1000 characters/);
    return { concepts: [{ name: 'Energy', rubric: rubric(items) }] };
  });
  assert.ok(concept.rubric.remember.length <= 1000);
  assert.ok(concept.rubric.remember.startsWith(`1. ${items[0]}`));
  assert.ok(concept.rubric.remember.split('\n').length < items.length);
  assert.equal(concept.rubric.apply, '');
});

test('rubric validation failures record which check failed', async () => {
  let calls = 0;
  await assert.rejects(generateRubric({ concepts: [{ name: 'Energy', target: 'apply' }] }, async () => {
    calls++;
    return { concepts: [{ name: 'Energy', rubric: rubric(['Defines energy.']) }] };
  }), error => error instanceof InvalidOutputError && /apply checklist for "Energy" is empty/.test(error.reason));
  assert.equal(calls, 2);
  await assert.rejects(generateRubric({ concepts: [{ name: 'Energy', target: 'remember' }] }, async () => ({ concepts: [{ name: 'energy', rubric: rubric(['Defines energy.']) }] })),
    error => /names did not match/.test(error.reason));
});
