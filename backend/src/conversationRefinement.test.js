import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { chat } from './chat.js';
import { createApiServer } from './server.js';
import { testAuthorization, testAccountService } from './accessTestHelper.js';

const input = () => ({ level: 'understand', learningType: 'theoretical', topic: 'Motion', aspects: ['Explain motion after contact ends'], messages: [{ role: 'assistant', content: 'What happens after the push ends?' }, { role: 'user', content: 'The stored push gradually runs out, so the puck slows.' }] });
function evaluatorResponse(messages, { status = 'supported', invalidQuote = false } = {}) {
  const material = JSON.parse(messages[0].content[0].text);
  const student = material.transcript.findLast(m => m.role === 'user');
  return { reason: 'Current evidence checked.', nextEvidenceObjective: status === 'supported' ? '' : 'Distinguish motion from a continuing interaction.', judgments: material.definitions.map(d => ({ criterionId: d.id, status, result: 'correct', reasoning: 'valid', opportunity: 'fair', reason: 'Checked the exact learner claim.', abstentionReason: '', observations: [{ messageId: student.messageId, quote: invalidQuote ? 'Invented evidence.' : student.content }], contradictions: [] })) };
}
const diagnostic = request => ({ understands: [], potentialMisconceptions: ['A stored push may be treated as a consumable cause.'], missingConcepts: ['Continuing interaction versus motion'], uncertainty: ['This is a hypothesis.'], diagnosticObjective: 'Distinguish a continuing interaction from motion.', evidence: [{ messageIndex: 1, quote: request.messages[1].content }] });
function plan(request) {
  return { strategyId: 'remove-condition', rationale: 'Examine persistence after contact ends.', plan: { targetMessageIndex: 1, targetQuote: request.messages[1].content, rubricItem: request.aspects[0], objective: 'Distinguish continued motion from continuing contact.', scenario: 'A puck moves on a horizontal frictionless surface after the hand lets go.', assumptions: ['No horizontal external interaction'], heldFixed: ['Surface and puck'], varied: ['Contact with the hand'], construction: 'Ask about the claimed cause after contact ends.', prerequisitesSatisfied: 'The learner discusses motion after a push.', limitations: ['One answer is not a stable belief.'], responseSignals: [{ hypothesis: 'Stored push', responsePattern: 'Push runs out.', interpretation: 'Investigate the stored-push hypothesis.' }, { hypothesis: 'No continuing influence', responsePattern: 'Motion continues.', interpretation: 'Ask for evidence of the relationship.' }] } };
}

test('ordinary conversation uses one refined primary and never legacy confirmation or shadow', async () => {
  const calls = [];
  const result = await chat(input(), async (_, messages, tool) => {
    calls.push(tool.name);
    assert.equal(tool.name, 'evaluate_refined');
    return evaluatorResponse(messages);
  });
  assert.deepEqual(calls, ['evaluate_refined']);
  assert.equal(result.assessment.complete, true);
  assert.equal(result.assessment.refined.completion.appliedToLearningSession, true);
  assert.equal(result.assessment.refined.completion.finalReview, 'disabled');
  assert.equal(result.assessment.criteria[0].evidence[0].messageIndex, 1);
});

test('ordinary learner applies the shared strategy pipeline to an incomplete refined assessment', async () => {
  const request = input();
  const calls = [];
  const result = await chat(request, async (instructions, messages, tool) => {
    calls.push(tool.name);
    if (tool.name === 'evaluate_refined') return evaluatorResponse(messages, { status: 'flawed' });
    if (tool.name === 'diagnose_understanding') {
      assert.equal(JSON.parse(messages[0].content).rubricAssessment.complete, false);
      return diagnostic(request);
    }
    if (tool.name === 'select_strategy') return plan(request);
    if (tool.name === 'validate_strategy_application') return { usable: true, reason: 'Preserves the learner claim without giving its correction.' };
    assert.equal(tool.name, 'respond_to_student');
    assert.match(instructions, /Apply the following diagnostic strategy/);
    return { message: 'After the hand loses contact with the puck, what could make its speed change on this frictionless surface?', expression: 'confused' };
  });
  assert.equal(result.assessment.complete, false);
  assert.equal(result.learnerModel.strategyId, 'remove-condition');
  assert.deepEqual(result.learnerModel.state.evidence, diagnostic(request).evidence);
  assert.equal(calls.filter(c => c === 'respond_to_student').length, 1, 'Do not generate an unused baseline question');
  assert.equal(calls.filter(c => c === 'validate_strategy_application').length, 2);
});

test('all rubric items remain mandatory and strategy abstention generates one ordinary fallback', async () => {
  const request = { ...input(), criterion: '1. Explain motion after contact ends\n2. Explain zero net force', aspects: ['stale aspect'] };
  let learnerCalls = 0;
  const result = await chat(request, async (_, messages, tool) => {
    if (tool.name === 'evaluate_refined') {
      const value = evaluatorResponse(messages);
      value.judgments[1] = { ...value.judgments[1], status: 'missing', observations: [] };
      return value;
    }
    if (tool.name === 'diagnose_understanding') return diagnostic(request);
    if (tool.name === 'select_strategy') return { strategyId: 'none', rationale: 'No suitable construction for this evidence.', plan: null };
    assert.equal(tool.name, 'respond_to_student');
    learnerCalls++;
    return { message: 'What does zero net force tell you about the puck’s motion?', expression: 'attentive' };
  });
  assert.equal(result.assessment.complete, false);
  assert.equal(result.assessment.criteria.length, 2);
  assert.equal(result.assessment.criteria[1].status, 'missing');
  assert.equal(result.learnerModel.strategyId, null);
  assert.equal(result.learnerModel.coverageGap.stage, 'selection');
  assert.equal(learnerCalls, 1);
});

test('fabricated citations cannot advance a regular conversation', async () => {
  const result = await chat(input(), async (_, messages, tool) => {
    if (tool.name === 'evaluate_refined') return evaluatorResponse(messages, { invalidQuote: true });
    if (tool.name === 'diagnose_understanding') return diagnostic(input());
    if (tool.name === 'select_strategy') return { strategyId: 'none', rationale: 'Need evidence.', plan: null };
    return { message: 'What interaction acts on the puck after contact ends?', expression: 'confused' };
  });
  assert.equal(result.assessment.complete, false);
  assert.ok(result.assessment.refined.validationIssues.some(i => i.code === 'invalid_citation'));
});

test('normal chat API activates refined evaluation even when client requests legacy controls', async t => {
  const names = [];
  const server = createApiServer({ accountService: testAccountService(), chatgpt: null, env: { ANTHROPIC_API_KEY: 'test-only' }, query: async (_, messages, tool) => { names.push(tool.name); return evaluatorResponse(messages); } });
  t.after(() => server.close());
  const req = Readable.from([JSON.stringify({ ...input(), evaluator: 'legacy', learner: 'default', shadow: true })]);
  Object.assign(req, { method: 'POST', url: '/api/chat', headers: { authorization: testAuthorization, host: 'localhost:3001', origin: 'http://localhost:5173', 'content-type': 'application/json' } });
  const result = await new Promise(resolve => server.emit('request', req, { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); } }));
  assert.equal(result.status, 200);
  assert.equal(result.data.assessment.complete, true);
  assert.deepEqual(names, ['evaluate_refined']);
});
