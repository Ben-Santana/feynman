import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyGuidanceGenerator } from './studyGuidance.js';

const report = { title: 'Ohm’s law', demonstrated: 1, assigned: 2, goals: [{ id: 'g', text: 'Rearrange V = IR', status: 'needs_work', reason: 'Divided only one side by R.', evidence: [{ quote: 'I = VR' }] }], levelChecks: [] };
const guidance = { nextSteps: ['Practice rearranging Ohm’s law to solve for current and resistance.'] };

test('guidance uses student evidence, deduplicates requests, and isolates owners and changed results', async () => {
  const generate = createStudyGuidanceGenerator();
  let calls = 0;
  const query = async (instructions, messages, response) => {
    calls++;
    assert.match(instructions, /untrusted data/);
    assert.match(instructions, /missing evidence does not prove misunderstanding/);
    assert.equal(response.name, 'summarize_student_results');
    const input = JSON.parse(messages[0].content);
    assert.equal(input.goals[0].evidence[0].quote, 'I = VR');
    assert.equal(input.goals[0].reason, 'Divided only one side by R.');
    return guidance;
  };
  const [first, second] = await Promise.all([generate('student', report, query), generate('student', report, query)]);
  assert.deepEqual(first, guidance);
  assert.deepEqual(second, guidance);
  assert.equal(calls, 1);
  await generate('other', report, query);
  await generate('student', { ...report, demonstrated: 2 }, query);
  assert.equal(calls, 3);
});

test('failures do not leave a poisoned cache or substitute generic guidance', async () => {
  const generate = createStudyGuidanceGenerator();
  await assert.rejects(generate('student', report, async () => { throw new Error('Provider unavailable'); }), /Provider unavailable/);
  assert.deepEqual(await generate('student', report, async () => guidance), guidance);
});

test('malformed summaries are repaired before being displayed', async () => {
  const generate = createStudyGuidanceGenerator();
  let calls = 0;
  const result = await generate('student', report, async () => ++calls === 1 ? { summary: '', nextSteps: [] } : guidance);
  assert.equal(calls, 2);
  assert.deepEqual(result, guidance);
});

for (const [label, invalid] of [
  ['long instruction', { nextSteps: ['Study ' + 'resistance '.repeat(16)] }],
  ['too many instructions', { nextSteps: Array(4).fill('Review resistance.') }],
  ['old verbose format', { nextSteps: [{ title: 'Resistance', description: 'Review resistance.' }] }],
]) {
  test(`repairs ${label} instead of displaying verbose guidance`, async () => {
    const generate = createStudyGuidanceGenerator();
    let calls = 0;
    const result = await generate('student', report, async () => ++calls === 1 ? invalid : guidance);
    assert.equal(calls, 2);
    assert.deepEqual(result, guidance);
  });
}
