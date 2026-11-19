import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { readFixes, keepEarnedCredit } from './loopFixes.js';
import { asksForClarity, expressesFrustration, rubricSkipReason } from '../../frontend/src/rubricFallback.js';

const bcd = 'States the 8421 BCD code for each digit.', weights = 'Gives the 2421 weights.';
const table = '5                  1011   0101\n6                  1100   0110';
const turns = (focus, replies) => replies.flatMap(content => [{ role: 'assistant', content: 'Which one?', rubricFocus: focus }, { role: 'user', content }]);
const input = messages => ({ level: 'remember', learningType: 'theoretical', topic: 'BCD', aspects: [bcd, weights], messages });
// Grader double: statuses per definition, quoting the latest learner message unless a quote is given.
const grader = (statuses, quote) => messages => {
  const data = JSON.parse(messages[0].content[0].text), user = data.transcript.findLast(m => m.role === 'user');
  return { reason: 'Checked.', nextEvidenceObjective: 'Ask for the BCD digits; ask for the 2421 weights.', judgments: data.definitions.map((d, index) => {
    const status = statuses[index] || 'missing', ok = status === 'supported';
    return { criterionId: d.id, status, result: ok ? 'correct' : 'undetermined', reasoning: ok ? 'not_required' : 'unclear', opportunity: 'fair', abstentionReason: '', observations: [{ messageId: user.messageId, quote: quote ?? user.content }], contradictions: [] };
  }) };
};
const run = async (messages, statuses, fixes, { quote, reply = 'Which weights does 2421 use?' } = {}) => {
  let system = '';
  const result = await chat(input(messages), async (instructions, body, tool) => {
    if (tool.name === 'evaluate_refined') return grader(statuses, quote)(body);
    system = instructions;
    return { message: reply, expression: 'attentive', strategyChoice: { strategyId: 'none', rationale: 'None fits.', targetQuote: '', rubricItem: '' } };
  }, undefined, fixes ? { fixes } : {});
  return { result, system };
};

test('fixes are read only from known flags and real rubric items', () => {
  assert.deepEqual(readFixes(undefined, [bcd]), {});
  assert.deepEqual(readFixes({ earned: [bcd] }, [bcd]), {});
  assert.deepEqual(readFixes({ keepCredit: true, plainAsk: 'yes', other: true, earned: [bcd, 'Invented', bcd] }, [bcd]), { keepCredit: true, earned: [bcd] });
});

test('with no fixes the reply prompt and target are unchanged', async () => {
  const { result, system } = await run(turns(weights, ['2, 4, 2, 1', 'as I said, 2421']), ['missing', 'missing']);
  assert.equal(result.rubricFocus, bcd);
  assert.doesNotMatch(system, /which single piece|ignore the rest/);
});

test('an earned item stays supported and the level passes once every item is earned', async () => {
  const messages = turns(bcd, ['0101 is five']);
  const lost = await run(messages, ['unclear', 'supported']);
  assert.equal(lost.result.assessment.criteria[0].status, 'needs_clarification');
  const kept = await run(messages, ['unclear', 'supported'], { keepCredit: true, earned: [bcd] });
  assert.equal(kept.result.assessment.criteria[0].status, 'supported');
  assert.equal(kept.result.assessment.complete, true);
  assert.equal(kept.result.message, 'Thank you for teaching me!');
  assert.equal(keepEarnedCredit(lost.result.assessment, []), lost.result.assessment);
});

test('a table quoted with collapsed spacing is credited only with tolerant matching, and invented quotes never are', async () => {
  const messages = turns(bcd, [table]), quote = '5 1011 0101';
  const strict = await run(messages, ['supported', 'supported'], undefined, { quote });
  assert.equal(strict.result.assessment.criteria[0].status, 'needs_clarification');
  const tolerant = await run(messages, ['supported', 'supported'], { tolerantQuotes: true, earned: [] }, { quote });
  assert.equal(tolerant.result.assessment.criteria[0].status, 'supported');
  const invented = await run(messages, ['supported', 'supported'], { tolerantQuotes: true, earned: [] }, { quote: '7 1101 0111' });
  assert.equal(invented.result.assessment.criteria[0].status, 'needs_clarification');
});

test('the classmate stays on the item it last asked about and gets one objective', async () => {
  const { result, system } = await run(turns(weights, ['2421']), ['missing', 'missing'], { stayOnItem: true, earned: [] });
  assert.equal(result.rubricFocus, weights);
  assert.match(system, /Use only the part about this requirement/);
});

test('the plain ask appears on the second reply to an item, on a request to reword, and on frustration', async () => {
  const fixes = { stayOnItem: true, plainAsk: true, hearFrustration: true, earned: [] };
  assert.doesNotMatch((await run(turns(weights, ['2421']), [], fixes)).system, /which single piece/);
  assert.match((await run(turns(weights, ['2421', '2, 4, 2, 1']), [], fixes)).system, /which single piece/);
  assert.match((await run(turns(weights, ['i don\'t get this question at all reword']), [], fixes)).system, /which single piece/);
  const angry = (await run(turns(weights, ['bro are you dumb or just trying to waste my time']), [], fixes)).system;
  assert.match(angry, /which single piece/);
  assert.match(angry, /apology of at most six words/);
  assert.doesNotMatch((await run(turns(weights, ['the weights are 2, 4, 2, 1 like I said']), [], fixes)).system, /which single piece/);
  assert.doesNotMatch((await run(turns(weights, ['8, 4, 2, 1', 'still 8, 4, 2, 1']), ['missing', 'flawed'], fixes)).system, /which single piece/);
});

test('wider frustration and clarity phrases from real chats are heard, ordinary teaching is not', () => {
  for (const text of ['how do you not understand that I understand at this point?', 'bro are you dumb or just trying to waste my time?', "as the name suggests and as I've said twice now, 2421 has the values 2,4,2,1", 'Please keep up']) {
    assert.equal(expressesFrustration(text), false, text);
    assert.equal(expressesFrustration(text, { broad: true }), true, text);
  }
  for (const text of ['Could you rephrase this question?', 'could you please point out the issue in simple terms', "i don't get this question at all reword"]) assert.equal(asksForClarity(text), true, text);
  for (const text of ['BCD gives each digit its own four bits.', 'The weights are 2, 4, 2 and 1, so 1011 is 5.', 'the limits are -inf to positive inf like I said']) {
    assert.equal(expressesFrustration(text, { broad: true }), false, text);
    assert.equal(asksForClarity(text), false, text);
  }
});

test('the earlier skip offer comes after four replies, three when frustration is heard', () => {
  const four = [...turns(weights, ['a', 'b', 'c', 'd']), { role: 'assistant', content: 'Which?', rubricFocus: weights }];
  assert.equal(rubricSkipReason(four, weights), null);
  assert.equal(rubricSkipReason(four, weights, { early: true }), 'attempts');
  const three = [...turns(weights, ['a', 'which I said', 'c']), { role: 'assistant', content: 'Which?', rubricFocus: weights }];
  assert.equal(rubricSkipReason(three, weights, { early: true }), null);
  assert.equal(rubricSkipReason(three, weights, { early: true, broad: true }), 'frustration');
});
