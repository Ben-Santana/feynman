import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { readFixes, keepEarnedCredit } from './loopFixes.js';
import { admitsNotKnowing, asksForClarity, expressesFrustration, rubricSkipReason, skippedRubricItems } from '../../frontend/src/rubricFallback.js';

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
  const fixes = { stayOnItem: true, plainAsk: true, earned: [] };
  assert.doesNotMatch((await run(turns(weights, ['2421']), [], fixes)).system, /which single piece/);
  assert.match((await run(turns(weights, ['2421', '2, 4, 2, 1']), [], fixes)).system, /which single piece/);
  assert.match((await run(turns(weights, ['i don\'t get this question at all reword']), [], fixes)).system, /which single piece/);
  const angry = (await run(turns(weights, ['what the hell, I answered this']), [], fixes)).system;
  assert.match(angry, /which single piece/);
  assert.match(angry, /apology of at most six words/);
  assert.doesNotMatch((await run(turns(weights, ['the weights are 2, 4, 2, 1 like I said']), [], fixes)).system, /which single piece/);
  assert.doesNotMatch((await run(turns(weights, ['8, 4, 2, 1', 'still 8, 4, 2, 1']), ['missing', 'flawed'], fixes)).system, /which single piece/);
});

test('requests to reword are recognised, ordinary teaching is not', () => {
  for (const text of ['Could you rephrase this question?', 'could you please point out the issue in simple terms', "i don't get this question at all reword"]) assert.equal(asksForClarity(text), true, text);
  for (const text of ['BCD gives each digit its own four bits.', 'the limits are -inf to positive inf like I said']) {
    assert.equal(expressesFrustration(text), false, text);
    assert.equal(asksForClarity(text), false, text);
  }
});

test('the skip offer needs frustration or the learner saying they do not know, never reply count alone', () => {
  const offer = replies => rubricSkipReason([...turns(weights, replies), { role: 'assistant', content: 'Which?', rubricFocus: weights }], weights, { aware: true });
  assert.equal(offer(['2, 4, 2, 1', 'as I said, 2421', 'the weights are in the name', 'a', 'b', 'c', 'd']), null);
  for (const text of ["I don't know", 'idk honestly', "I can't remember the weights", 'not sure about that one', "we haven't covered that", "I'm confused about the weights"]) assert.equal(offer([text]), 'unsure', text);
  assert.equal(offer(['This is bullshit.']), 'frustration');
  for (const text of ["I don't understand the question", 'Could you rephrase this question?', "I don't know what you are asking", 'could you please point out the issue in simple terms', 'Why are you asking if I would like to skip?']) {
    assert.equal(admitsNotKnowing(text), false, text);
    assert.equal(offer([text]), null, text);
  }
  const declined = [...turns(weights, ["I don't know"]), { role: 'assistant', content: 'Which?', rubricFocus: weights, skipOfferDeclined: true }, { role: 'user', content: '2, 4, 2, 1' }, { role: 'assistant', content: 'Which?', rubricFocus: weights }];
  assert.equal(rubricSkipReason(declined, weights, { aware: true }), null);
  const skip = { role: 'user', content: 'Skip this rubric item', skipRubricItem: weights };
  assert.deepEqual([...skippedRubricItems([...turns(weights, ["I don't know"]), { role: 'assistant', content: 'Which?', rubricFocus: weights }, skip], [weights])], [weights]);
  assert.throws(() => skippedRubricItems([...turns(weights, ['2, 4, 2, 1']), { role: 'assistant', content: 'Which?', rubricFocus: weights }, skip], [weights]), /not available/);
});

test('learners get every fix with credit from their last saved assessment', async () => {
  const { learnerFixes, fixNames } = await import('./loopFixes.js');
  const fixes = learnerFixes({ criteria: [{ aspect: bcd, status: 'supported' }, { aspect: weights, status: 'missing' }, { aspect: 'Old item', status: 'supported' }] }, [bcd, weights]);
  for (const name of fixNames) assert.equal(fixes[name], true);
  assert.deepEqual(fixes.earned, [bcd]);
  assert.deepEqual(learnerFixes(undefined, [bcd]).earned, []);
});
