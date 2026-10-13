import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTargetedQuestion } from './questionTargeting.js';

test('rejects generic reasoning requests including contextual preambles and paraphrases', () => {
  for (const question of ['Could you walk me through that reasoning?', 'Can you talk me through the work calculation?', 'The cart moves at constant speed. Could you explain your thinking?', 'Could you elaborate?', 'Can you explain that?', 'What makes you think so?', 'How did you arrive at that conclusion?', 'Can you tell me more?']) assert.throws(() => assertTargetedQuestion(question), /generic reasoning/);
});
test('permits questions about specific claims and relationships without requiring a calculation', () => {
  for (const question of ['You said kinetic energy increases while speed stays constant. What changes in the cart that would increase its kinetic energy?', 'How does the distance traveled tell you whether a net force acts on the cart?', 'What do you mean by stored force?', 'Why would the puck slow down after contact ends?', 'How do the two vehicles exert forces on each other?']) assert.doesNotThrow(() => assertTargetedQuestion(question));
});
