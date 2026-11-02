import test from 'node:test';
import assert from 'node:assert/strict';
import { inlineQuestionStrategies } from './inlineQuestionStrategies.js';

const input = { level: 'remember', aspects: ['Name the force'], messages: [{ role: 'assistant', content: 'Is it gravity?' }, { role: 'user', content: 'I do not recall.' }] };
const choice = { strategyId: 'recall-specific-element', rationale: 'Recall a missing force name.', targetQuote: 'I do not recall.', rubricItem: 'Name the force' };

test('inline catalog only offers reviewed strategies eligible for the active level', () => {
  const inline = inlineQuestionStrategies(input);
  assert.deepEqual(inline.property.properties.strategyId.enum.sort(), ['clarify-specific-term', 'none', 'recall-specific-element']);
  assert.equal(inline.validate(choice).strategyId, 'recall-specific-element');
  assert.throws(() => inline.validate({ ...choice, strategyId: 'remove-condition' }), /compatible with the active level/);
});

test('inline strategy requires learner evidence, an active rubric item, and an explicit abstention', () => {
  const inline = inlineQuestionStrategies(input);
  for (const invalid of [undefined, { ...choice, rationale: '' }, { ...choice, targetQuote: 'Is it gravity?' }, { ...choice, rubricItem: 'Invented requirement' }, { ...choice, strategyId: 'none' }]) assert.throws(() => inline.validate(invalid));
  assert.equal(inline.validate({ strategyId: 'none', rationale: 'No suitable strategy.', targetQuote: '', rubricItem: '' }).strategyId, null);
});
