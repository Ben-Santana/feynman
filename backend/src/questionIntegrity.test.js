import test from 'node:test';
import assert from 'node:assert/strict';
import { assertQuestionIntegrity, questionIntegrityInstructions } from './questionTargeting.js';

test('rejects observed solution scaffolds and factive misconception framing', () => {
  for (const question of [
    'For this resistor the relationship is V = IR. What current do you get?',
    'What current do you get when you isolate I in that equation?',
    'When you check 10 by dividing it by 6, does it support your claim?',
    'What probability do you calculate rather than impose the expected count of two?',
    'Why does the casing staying still rule out the lost energy remaining inside?',
    'Why does being even alone establish that a number is a multiple of six?',
    'How does having the same probability lead to a guaranteed count?',
    'What makes the simple arithmetic mean appropriate for those durations?',
  ]) assert.throws(() => assertQuestionIntegrity(question));
});

test('permits neutral hypotheses, necessary givens, and level-specific elicitation', () => {
  for (const question of [
    'What makes you think being even is enough to be a multiple of six?',
    'The resistor is 10 ohms and the potential difference is zero. What current do you calculate?',
    'For ten independent replacement draws with red probability one fifth, what probability do you calculate for no reds?',
    'In your account, how are the casing motion and the energy inside the device related?',
    'What is the name of the component that opposes current?',
    'What evidence supports using an arithmetic mean for this trip?',
  ]) assert.doesNotThrow(() => assertQuestionIntegrity(question));
  assert.match(questionIntegrityInstructions, /At Remember/);
  assert.match(questionIntegrityInstructions, /at Apply/);
});
