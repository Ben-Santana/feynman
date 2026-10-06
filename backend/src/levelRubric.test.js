import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLevelRubric } from './chat.js';
import { checklistText } from '../../frontend/src/rubricChecklist.js';

test('playground rubric generation requests only the selected level and learning type', async () => {
  for (const level of ['remember', 'understand', 'apply', 'analyze']) {
    const items = ['Identifies faulty reasoning in a proposed circuit design.', 'Explains the consequences of the faulty reasoning.'];
    const result = await generateLevelRubric({ topic: 'Circuits', level, learningType: 'design' }, async (system, messages, responseTool) => {
      assert.ok(system.includes(`Write only the ${level} checklist`));
      assert.match(system, /Design \/ Project-Based/);
      assert.deepEqual(JSON.parse(messages[0].content), { concept: 'Circuits', level });
      assert.equal(responseTool.schema.properties.items.maxItems, 8);
      return { items };
    });
    assert.deepEqual(result.items, items);
    assert.equal(Object.hasOwn(result, 'concepts'), false);
  }
});

test('generated checklists fit the chat criterion limit and reject incomplete responses', async () => {
  const input = { topic: 'Circuits', level: 'analyze' };
  const result = await generateLevelRubric(input, async () => ({ items: Array(8).fill('x'.repeat(120)) }));
  assert.ok(checklistText(result.items).length <= 1000);
  const naturalLength = await generateLevelRubric(input, async () => ({ items: ['x'.repeat(129), 'A short second requirement.'] }));
  assert.equal(naturalLength.items[0].length, 129);
  for (const items of [undefined, [], [''], ['first\nsecond'], ['x'.repeat(1001)], Array(8).fill('x'.repeat(125)), Array(9).fill('Item'), [null]]) {
    await assert.rejects(generateLevelRubric(input, async () => ({ items })), /Could not generate rubric items/);
  }
});

test('invalid playground setup fails before requesting a rubric', async () => {
  for (const input of [null, { topic: '', level: 'analyze' }, { topic: 'Circuits', level: '__proto__' }, { topic: 'Circuits', level: 'analyze', learningType: 'invalid' }]) {
    await assert.rejects(generateLevelRubric(input, async () => { assert.fail('Invalid setup must not call Claude.'); }));
  }
});
