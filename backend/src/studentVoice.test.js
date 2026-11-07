import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { loadPrompts } from './promptStore.js';

const aspects = ['Names the quantities in Ohm’s law'];
const assessment = () => ({ complete: false, readyToAdvance: false, reason: 'x', nextQuestionFocus: 'Elicit what V represents.', criteria: aspects.map(aspect => ({ aspect, status: 'missing', result: 'not_applicable', evidence: [] })), task: { status: 'missing', result: 'not_applicable', evidence: [] }, refined: { judgments: [] } });
const input = level => ({ topic: 'Ohm’s law', level, learningType: 'quantitative', aspects, messages: [{ role: 'assistant', content: 'Teach me about Ohm’s law.' }, { role: 'user', content: 'V = IR' }] });
async function reply(level, message = 'Okay. What is V?') {
  let request;
  const result = await chat(input(level), async (instructions, messages, response) => {
    request = { instructions, response };
    return { message, expression: 'attentive', strategyChoice: { strategyId: 'none', rationale: 'No strategy fits.', targetQuote: '', rubricItem: '', background: null } };
  }, undefined, { persistedAssessment: assessment() }).catch(error => ({ error }));
  return { request, result };
}

for (const level of ['remember', 'understand', 'apply']) {
  test(`${level} reply prompt keeps "student" for the AI and ends on voice`, async () => {
    const { request } = await reply(level);
    assert.equal(request.response.name, 'reply_to_teacher');
    assert.match(request.instructions.slice(request.instructions.indexOf(loadPrompts().text('chat.studentVoice'))), /^How you sound[\s\S]*Open this one differently, and if you confirm, use different words, not a close variation\.\s*$/);
    assert.doesNotMatch(request.instructions, /confused\/unsure preambles/);
    const mentions = request.instructions.match(/.{0,30}\bstudents?\b/gi) || [];
    assert.deepEqual(mentions.filter(text => !/(plays a classroom|You are a|curious or confused|Talk like a) student$/i.test(text)), []);
  });
}

test('opening praise never reaches the teacher', async () => {
  const { result } = await reply('remember', "That's a good start! What does the V stand for?");
  assert.equal(result.message, 'What does the V stand for?');
});

test('invalid strategy metadata retries once, then keeps the checked question', async () => {
  let calls = 0;
  const result = await chat(input('understand'), async () => {
    calls++;
    return { message: 'I can’t place the letters yet. What does V measure?', expression: 'attentive', strategyChoice: { strategyId: 'clarify-specific-term', rationale: 'Clarify V.', targetQuote: 'not in the transcript', rubricItem: aspects[0], background: null } };
  }, undefined, { persistedAssessment: assessment() });
  assert.equal(calls, 2);
  assert.equal(result.message, 'I can’t place the letters yet. What does V measure?');
  assert.equal(result.learnerModel.strategyId, null);
  assert.match(result.learnerModel.coverageGap.reason, /exact current learner quote/);
  assert.equal(result.rubricFocus, aspects[0]);
});

test('a rejected question still fails after the retry', async () => {
  await assert.rejects(chat(input('understand'), async () => ({ message: 'Could you walk me through that reasoning?', expression: 'attentive', strategyChoice: { strategyId: 'none', rationale: 'None fits.', targetQuote: '', rubricItem: '', background: null } }), undefined, { persistedAssessment: assessment() }), /generic reasoning/);
});

test('each reply is told how the last three messages opened', async () => {
  let instructions;
  const messages = ['First opening here today.', 'I have got one.', 'I have got two.', 'I have got three.'].flatMap((content, index) => [{ role: 'assistant', content }, { role: 'user', content: `Answer ${index}` }]);
  await chat({ ...input('remember'), messages }, async system => { instructions = system; return { message: 'Lima, okay. What is V?', expression: 'attentive', strategyChoice: { strategyId: 'none', rationale: 'None fits.', targetQuote: '', rubricItem: '', background: null } }; }, undefined, { persistedAssessment: assessment() });
  assert.match(instructions, /opened with \["I have got","I have got","I have got"\]/);
});

test('replies confirm briefly without filler acknowledgements', async () => {
  const { request } = await reply('remember');
  assert.doesNotMatch(request.instructions, /React to the learner/);
  assert.match(request.instructions, /start with a short, casual confirmation/);
  assert.match(request.instructions, /Do not say something makes sense, clicks, or helps/);
  assert.doesNotMatch(loadPrompts().text('chat.studentVoice').slice(loadPrompts().text('chat.studentVoice').indexOf('Tone examples only')), /makes? sense/i);
});

test('a confirmation from the last few messages is dropped', async () => {
  const messages = ['Got it, V = IR. What is V?', 'Okay. What is I?'].flatMap((content, index) => [{ role: 'assistant', content }, { role: 'user', content: `Answer ${index}` }]);
  const send = async message => (await chat({ ...input('remember'), messages }, async () => ({ message, expression: 'attentive', strategyChoice: { strategyId: 'none', rationale: 'None fits.', targetQuote: '', rubricItem: '', background: null } }), undefined, { persistedAssessment: assessment() })).message;
  assert.equal(await send('Got it. What units does R use?'), 'What units does R use?');
  assert.equal(await send('okay, what units does R use?'), 'What units does R use?');
  assert.equal(await send('Gotcha. What units does R use?'), 'Gotcha. What units does R use?');
});
