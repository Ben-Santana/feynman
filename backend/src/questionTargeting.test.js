import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTargetedQuestion, withoutOpeningPraise, withoutRepeatedConfirmation } from './questionTargeting.js';

test('rejects generic reasoning requests including contextual preambles and paraphrases', () => {
  for (const question of ['Could you walk me through that reasoning?', 'Can you talk me through the work calculation?', 'The cart moves at constant speed. Could you explain your thinking?', 'Could you elaborate?', 'Can you explain that?', 'What makes you think so?', 'How did you arrive at that conclusion?', 'Can you tell me more?']) assert.throws(() => assertTargetedQuestion(question), /generic reasoning/);
});
test('permits questions about specific claims and relationships without requiring a calculation', () => {
  for (const question of ['You said kinetic energy increases while speed stays constant. What changes in the cart that would increase its kinetic energy?', 'How does the distance traveled tell you whether a net force acts on the cart?', 'What do you mean by stored force?', 'Why would the puck slow down after contact ends?', 'How do the two vehicles exert forces on each other?']) assert.doesNotThrow(() => assertTargetedQuestion(question));
});

test('opening praise is removed without touching the question', () => {
  assert.equal(withoutOpeningPraise("That's a good start! What does V stand for?"), 'What does V stand for?');
  assert.equal(withoutOpeningPraise('That’s a really great point. Great! What is V?'), 'What is V?');
  assert.equal(withoutOpeningPraise('Exactly! Where did the rest go?'), 'Where did the rest go?');
  assert.equal(withoutOpeningPraise("That's a nice compact formula! What is V?"), 'What is V?');
  for (const message of ['Great!', 'Okay, V = IR. What is V?', 'Right, so where did the rest go?', 'A good start for the circuit is what?', 'Is a good answer one with units?']) assert.equal(withoutOpeningPraise(message), message);
});

test('only a short repeated confirmation is removed', () => {
  const recent = ['Got it, V = IR. What is V?', 'What units do voltage, current, and resistance each use?'];
  assert.equal(withoutRepeatedConfirmation('Got it, the unit is ohms. What is I?', recent), 'The unit is ohms. What is I?');
  for (const message of ['Cool. What is I?', 'What units do voltage, current, and resistance each use?', 'Got it?']) assert.equal(withoutRepeatedConfirmation(message, recent), message);
});
