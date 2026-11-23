import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { prepareRefinedEvaluation } from './refinedEvaluator.js';
import { feedbackKind, needsHint, repeatedQuestion } from './turnGuidance.js';
import { learnerFixes } from './loopFixes.js';

const horizontal = 'Explains how to find where a parametric curve has a horizontal tangent.';
const vertical = 'Explains how to find where a parametric curve has a vertical tangent.';
const both = 'Horizontal tangents are where dy/dt is zero and dx/dt is not. Vertical tangents are where dx/dt is zero and dy/dt is not.';
const turns = (focus, replies) => replies.flatMap(content => [{ role: 'assistant', content: 'Where is the tangent horizontal?', ...(focus ? { rubricFocus: focus } : {}) }, { role: 'user', content }]);
const input = messages => ({ level: 'understand', learningType: 'quantitative', topic: 'Parametric curves', aspects: [horizontal, vertical], messages });
const grader = statuses => messages => {
  const data = JSON.parse(messages[0].content[0].text), user = data.transcript.findLast(m => m.role === 'user');
  return { reason: 'Checked.', nextEvidenceObjective: 'Find where the tangent is horizontal and where it is vertical.', judgments: data.definitions.map((d, index) => {
    const status = statuses[index] || 'supported', ok = status === 'supported', wrong = status === 'flawed';
    return { criterionId: d.id, status, result: ok ? 'correct' : wrong ? 'incorrect' : 'undetermined', reasoning: ok ? 'valid' : wrong ? 'flawed' : 'unclear', opportunity: 'fair', abstentionReason: '', observations: status === 'missing' ? [] : [{ messageId: user.messageId, quote: user.content }], contradictions: [] };
  }) };
};
const run = async (messages, statuses, { replies = ['What makes the tangent vertical at a point?'], earned } = {}) => {
  const seen = { learner: [], evaluator: '' };
  const fixes = learnerFixes(earned ? { criteria: earned.map(aspect => ({ aspect, status: 'supported' })) } : undefined, [horizontal, vertical]);
  const result = await chat(input(messages), async (instructions, body, tool) => {
    if (tool.name === 'evaluate_refined') { seen.evaluator = instructions; return grader(statuses)(body); }
    seen.learner.push(instructions);
    return { message: replies[Math.min(seen.learner.length, replies.length) - 1], expression: 'attentive', strategyChoice: { strategyId: 'none', rationale: 'None fits.', targetQuote: '', rubricFocus: '', rubricItem: '' } };
  }, undefined, { fixes });
  return { result, system: seen.learner.at(-1) || '', calls: seen.learner.length, evaluator: seen.evaluator };
};

test('correct: one answer covering both tangent cases finishes the level with no further question', async () => {
  const { result, calls, evaluator } = await run(turns(undefined, [both]), ['supported', 'supported']);
  assert.equal(result.assessment.complete, true);
  assert.equal(calls, 0, 'the classmate is not asked for another question');
  assert.match(evaluator, /one learner message covers several cases or parts at once/);
  assert.match(evaluator, /Never set a nextEvidenceObjective that asks for something a learner message already states correctly/);
});

test('correct then new: a demonstrated item is out of scope and the reply marks a new question', async () => {
  const { result, system } = await run(turns(horizontal, ['The tangent is horizontal where dy/dt is zero and dx/dt is not.']), ['supported', 'missing']);
  assert.equal(result.rubricFocus, vertical);
  assert.match(system, /Already demonstrated, so out of scope for questions: \["Explains how to find where a parametric curve has a horizontal tangent\."\]/);
  assert.match(system, /settled what you asked/);
  assert.match(system, /moving to a different point/);
  assert.doesNotMatch(system, /does not hold up|one piece is still absent/);
  assert.match(system, /If the teacher has already explained what you are about to ask/);
});

test('credit earned on an earlier turn is kept, so that item is never asked about again', async () => {
  const messages = [...turns(undefined, [both]), ...turns(vertical, ['I already covered vertical tangents above.'])];
  const { result, system } = await run(messages, ['unclear', 'missing'], { earned: [horizontal] });
  assert.equal(result.assessment.criteria[0].status, 'supported');
  assert.equal(result.rubricFocus, vertical);
  assert.match(system, /Already demonstrated, so out of scope/);
});

test('incomplete: the reply names what was followed and asks only for the missing piece', async () => {
  const { result, system } = await run(turns(horizontal, ['The tangent is horizontal where dy/dt is zero.']), ['unclear', 'missing']);
  assert.equal(result.assessment.complete, false);
  assert.equal(result.rubricFocus, horizontal);
  assert.match(system, /holds up as far as it goes, and one piece is still absent/);
  assert.match(system, /Nothing in your message may suggest that what they said was wrong/);
  assert.doesNotMatch(system, /does not hold up|settled what you asked/);
  // Incomplete is not treated as passed: the item stays open.
  assert.equal(result.assessment.criteria[0].status, 'needs_clarification');
});

test('incorrect: the reply marks a statement to recheck without correcting it, and the item stays open', async () => {
  const { result, system } = await run(turns(horizontal, ['The tangent is horizontal where dx/dt is zero.']), ['flawed', 'missing']);
  assert.equal(result.assessment.criteria[0].status, 'flawed');
  assert.equal(result.rubricFocus, horizontal);
  assert.match(system, /something specific the teacher said does not hold up/);
  assert.match(system, /Do not state or hint at the correction/);
  assert.doesNotMatch(system, /Give one targeted nudge/);
});

test('incorrect twice: the reply gives a targeted nudge instead of rewording the request, still without the answer', async () => {
  const { result, system } = await run(turns(horizontal, ['The tangent is horizontal where dx/dt is zero.', 'It is where x stops changing.']), ['flawed', 'missing']);
  assert.equal(result.assessment.complete, false);
  assert.match(system, /Give one targeted nudge/);
  assert.match(system, /must not state the answer, the correct name, a formula, or a value/);
  assert.match(system, /do not merely reword your earlier question/);
});

test('a reworded repeat of an earlier question is retried once and never fails the turn', async () => {
  const earlier = 'Okay. For the curve x = t^2 and y = t^3 - 3t, where exactly is the tangent line horizontal?';
  const messages = [{ role: 'assistant', content: earlier, rubricFocus: horizontal }, { role: 'user', content: 'Where dy/dt is zero.' }];
  const repeat = 'For the curve x = t^2 and y = t^3 - 3t, where is the tangent line horizontal exactly?';
  const fixed = await run(messages, ['unclear', 'missing'], { replies: [repeat, 'What has to be true of dx/dt at those points?'] });
  assert.equal(fixed.calls, 2);
  assert.match(fixed.system, /reworded a question it already asked/);
  assert.equal(fixed.result.message, 'What has to be true of dx/dt at those points?');
  const stubborn = await run(messages, ['unclear', 'missing'], { replies: [repeat, repeat.replace('exactly', 'precisely')] });
  assert.equal(stubborn.calls, 2);
  assert.match(stubborn.result.message, /precisely/);
  assert.equal(repeatedQuestion('What happens to the slope when dx/dt is zero there?', [earlier]), null);
});

test('questions state the required answer form and counting convention up front', async () => {
  const { system } = await run(turns(horizontal, ['The tangent is horizontal where dy/dt is zero.']), ['unclear', 'missing']);
  assert.match(system, /ask for that form in the same question/);
  assert.match(system, /Never ask afterwards for a form your question did not request/);
  assert.match(system, /"How many terms" and "the index of the last term" are different questions/);
});

test('the evaluator accepts equivalent answer forms and conventions but keeps required reasoning', () => {
  const { instructions } = prepareRefinedEvaluation({ level: 'apply', learningType: 'quantitative', topic: 'Taylor approximation', aspects: ['Approximates a value with a Taylor polynomial and bounds the error.'], messages: [{ role: 'assistant', content: 'Approximate e^0.1.' }, { role: 'user', content: 'About 1.105, with error under 0.0002.' }] });
  assert.match(instructions, /only when the rubric item or the question the learner was answering asks for it in words/);
  assert.match(instructions, /reasoning the rubric requires stays required/);
  assert.match(instructions, /accept every equivalent correct convention/);
  assert.match(instructions, /a correct answer with flawed reasoning cannot pass|correct result cannot hide invalid or unclear reasoning/);
});

test('feedback kinds and hints follow the assessment, not the wording of the answer', () => {
  const item = (aspect, status, cited) => ({ aspect, status, evidence: cited ? [{ messageIndex: 1, quote: 'x' }] : [] });
  const messages = turns(horizontal, ['answer']);
  const kind = (criteria, target, contradicted) => feedbackKind({ messages, checked: { criteria }, target, contradicted });
  const flawed = item(horizontal, 'flawed', true), unclear = item(horizontal, 'needs_clarification', true), done = item(horizontal, 'supported', true), open = item(vertical, 'missing');
  assert.equal(kind([flawed, open], flawed), 'mistake');
  assert.equal(kind([unclear, open], unclear, true), 'mistake');
  assert.equal(kind([unclear, open], unclear), 'incomplete');
  assert.equal(kind([done, open], open), 'new_question');
  assert.equal(kind([item(horizontal, 'missing'), open], item(horizontal, 'missing')), null);
  assert.equal(feedbackKind({ messages: [], checked: null }), null);
  assert.equal(needsHint(messages, flawed), false);
  assert.equal(needsHint(turns(horizontal, ['a', 'b']), flawed), true);
  assert.equal(needsHint(turns(horizontal, ['a', 'b']), unclear), false, 'a missing piece gets a plain ask, not a hint');
});
