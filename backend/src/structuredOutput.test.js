import test from 'node:test';
import assert from 'node:assert/strict';
import { InvalidOutputError, retryStructuredOutput, repairQuery } from './structuredOutput.js';

test('repairs malformed evidence with the validation detail and recovers on the third attempt', async () => {
  const attempts = [];
  const result = await retryStructuredOutput(async (attempt, signal, previousError) => {
    attempts.push(attempt);
    if (attempt < 2) throw new InvalidOutputError('Unused evidence IDs: e2');
    return repairQuery(async instructions => instructions, attempt, signal, previousError)('Assess evidence.', [], { name: 'evaluate_refined' });
  }, 60_000, 3);
  assert.deepEqual(attempts, [0, 1, 2]);
  assert.match(result, /Validation error: Unused evidence IDs: e2/);
});

test('stops after three invalid outputs and preserves the final error', async () => {
  let calls = 0;
  const error = new InvalidOutputError('Invalid reference');
  await assert.rejects(retryStructuredOutput(async () => { calls++; throw error; }, 60_000, 3), e => e === error);
  assert.equal(calls, 3);
});

test('does not retry transport or authentication failures', async () => {
  let calls = 0;
  const error = new Error('Unauthorized');
  await assert.rejects(retryStructuredOutput(async () => { calls++; throw error; }), e => e === error);
  assert.equal(calls, 1);
});
