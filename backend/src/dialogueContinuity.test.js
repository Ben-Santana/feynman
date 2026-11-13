import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { evaluateRefined } from './refinedEvaluator.js';

const rule = 'Explain the AND condition.';
const table = 'Explain constructing a truth table.';
const request = { level: 'understand', learningType: 'theoretical', topic: 'AND gates', aspects: [rule, table], messages: [
  { id: 'q', role: 'assistant', content: 'How does the rule give each output?', rubricFocus: table },
  { id: 'u', role: 'user', content: 'I list all input combinations. For each row, both inputs must be 1 for output 1; otherwise output is 0.' },
] };
const judged = (criterionId, supported = true) => ({ criterionId, status: supported ? 'supported' : 'unclear', result: supported ? 'correct' : 'undetermined', reasoning: supported ? 'valid' : 'unclear', opportunity: 'fair', abstentionReason: '', observations: supported ? [{ evidenceId: 'e1' }] : [], contradictions: [] });
const raw = () => ({ reason: 'The rule and its use are explained.', nextEvidenceObjective: '', evidence: [{ id: 'e1', messageId: 'u', quote: request.messages[1].content }], judgments: ['criterion_1', 'criterion_2', 'level_task'].map(id => judged(id)) });

test('one learner answer can satisfy multiple items and finish without a response call', async () => {
  const calls = [];
  const result = await chat(request, async (_system, _messages, tool) => { calls.push(tool.name); return raw(); });
  assert.deepEqual(calls, ['evaluate_refined']);
  assert.equal(result.assessment.complete, true);
  assert.ok(result.assessment.criteria.every(item => item.status === 'supported'));
});

test('follow-up strategy is scoped to the unresolved item and receives prior evidence without another call', async () => {
  const calls = [];
  const result = await chat(request, async (system, _messages, tool) => {
    calls.push(tool.name);
    if (tool.name === 'evaluate_refined') {
      const value = raw(); value.judgments[1] = judged('criterion_2', false); value.judgments[2] = judged('level_task', false);
      value.nextEvidenceObjective = 'Explain enumerating the input combinations.';
      return value;
    }
    assert.deepEqual(tool.schema.properties.strategyChoice.properties.rubricItem.enum, [table, '']);
    assert.match(system, /Dialogue state/);
    assert.match(system, /Do not restart an explanation/);
    assert.match(system, /How does the rule give each output/);
    return { message: 'How do you make sure every input combination is included?', expression: 'attentive', strategyChoice: { strategyId: 'none', rationale: 'Ask for the remaining enumeration gap.', targetQuote: '', rubricItem: '', background: null } };
  });
  assert.deepEqual(calls, ['evaluate_refined', 'reply_to_teacher']);
  assert.equal(result.rubricFocus, table);
});

test('a skipped rubric quote cannot be credited as learner knowledge', async () => {
  const history = Array.from({ length: 3 }, (_, index) => [
    { id: `q${index}`, role: 'assistant', content: 'How do you construct the table?', rubricFocus: table },
    { id: `a${index}`, role: 'user', content: 'I am unsure.' },
  ]).flat();
  const value = { ...request, messages: [...history, request.messages[0], { ...request.messages[1], content: `Skip: ${table}`, skipRubricItem: table }] };
  const result = await evaluateRefined(value, async () => {
    const output = raw(); output.evidence[0].quote = value.messages.at(-1).content; return output;
  });
  assert.equal(result.completion.eligible, false);
  assert.ok(result.validationIssues.some(issue => issue.code === 'invalid_citation'));
});

test('skip routes directly to a distinct remaining goal with no strategy or extra call', async () => {
  const history = Array.from({ length: 6 }, (_, index) => [
    { id: `q${index}`, role: 'assistant', content: 'What condition sets the output?', rubricFocus: rule },
    { id: `a${index}`, role: 'user', content: 'I am unsure.' },
  ]).flat();
  const calls = [];
  const result = await chat({ ...request, messages: [...history,
    { id: 'skip_q', role: 'assistant', content: 'What condition sets the output?', rubricFocus: rule },
    { id: 'skip_u', role: 'user', content: 'Skip this.', skipRubricItem: rule },
  ] }, async (system, _messages, tool) => {
    calls.push(tool.name);
    if (tool.name === 'evaluate_refined') return { reason: 'No demonstrated knowledge yet.', nextEvidenceObjective: '', evidence: [], judgments: ['criterion_1', 'criterion_2', 'level_task'].map(id => judged(id, false)) };
    assert.equal(tool.schema.properties.strategyChoice, undefined);
    assert.match(system, /"skipped":\[1\],"target":2/);
    assert.match(system, /never the skipped explanation through another example/);
    return { message: 'How would you list every possible input combination?', expression: 'attentive' };
  });
  assert.deepEqual(calls, ['evaluate_refined', 'reply_to_teacher']);
  assert.equal(result.rubricFocus, table);
  assert.equal(result.assessment.criteria[0].skipped, true);
});

test('level transition carries the latest whiteboard image in the single opening call', async () => {
  const boardImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
  let calls = 0;
  await chat({ ...request, messages: [], priorMessages: [request.messages[0], { ...request.messages[1], boardImage }] }, async (system, messages, tool) => {
    calls++;
    assert.equal(tool.name, 'reply_to_teacher');
    assert.equal(messages[0].content.find(block => block.type === 'image').data, boardImage.split(',')[1]);
    assert.match(messages[0].content[0].text, /continuity only, not new-level evidence/);
    assert.match(system, /Never claim you cannot see a board/);
    return { message: 'How does your rule explain the output when one input is low?', expression: 'attentive' };
  });
  assert.equal(calls, 1);
});
