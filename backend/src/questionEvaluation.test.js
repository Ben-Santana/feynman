import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { comparisonCases } from './questionStrategies.js';
import { blindQuestionPair, validateQuestionReview, reviewQuestionPair } from './questionEvaluation.js';
import { createApiServer } from './server.js';
import { testAuthorization, testAccountService } from './accessTestHelper.js';

const fixture = comparisonCases.find(item => item.expectedStrategyId === 'necessary-sufficient');
const baseline = 'What does being even establish in your statement about multiples of six?';
const enhanced = 'How does your implication connect being even to being divisible by six?';
const rating = { score: 2, reason: 'Specific, grounded, and asks about the existing relationship.' };
const makeReview = () => ({ questions: ['A', 'B'].map(label => ({ label, ...Object.fromEntries(['clarity', 'levelFit', 'diagnosticValue', 'grounding', 'nonLeading'].map(key => [key, { ...rating }])), strengths: ['Names the unresolved implication.'], concerns: [] })), preference: 'tie', reason: 'Both address the same inference.' });

test('blind question context hides branch identity, strategy labels, and review expectations', () => {
  const { mapping, context } = blindQuestionPair(fixture, baseline, enhanced);
  assert.deepEqual(new Set(Object.values(mapping)), new Set(['baseline', 'enhanced']));
  assert.deepEqual(new Set(Object.values(context.questions)), new Set([baseline, enhanced]));
  for (const key of ['expectedStrategyId', 'comparisonMode', 'title', 'reviewGuide']) assert.equal(context[key], undefined);
  assert.equal(context.diagnosticObjective, fixture.reviewGuide.target);
});

test('review validation rejects invented critique quotations and out-of-range ratings', () => {
  const { context } = blindQuestionPair(fixture, baseline, enhanced);
  const invented = makeReview();
  invented.questions[0].concerns.push({ dimension: 'clarity', severity: 'major', quote: 'A phrase neither question contains.', reason: 'Confusing.' });
  assert.throws(() => validateQuestionReview(invented, context.questions), /quote the actual candidate/);
  const invalidScore = makeReview(); invalidScore.questions[0].clarity.score = 3;
  assert.throws(() => validateQuestionReview(invalidScore, context.questions), /quality ratings/);
  const duplicate = makeReview(); duplicate.questions[1].label = 'A';
  assert.throws(() => validateQuestionReview(duplicate, context.questions), /Invalid paired/);
});

test('a blind model review is mapped back to the branches and keeps its limitations', async () => {
  const review = await reviewQuestionPair(fixture, baseline, enhanced, async (instructions, messages, response) => {
    assert.equal(response.name, 'review_question_pair');
    assert.match(instructions, /do not know which branch/i);
    assert.equal(JSON.parse(messages[0].content).expectedStrategyId, undefined);
    return makeReview();
  });
  assert.equal(review.questions.baseline.total, 10);
  assert.equal(review.questions.enhanced.total, 10);
  assert.equal(review.preference, 'tie');
  assert.match(review.limitation, /not independent expert validation/);
});

async function invoke(server, body, hosted = false) {
  const authorization = testAuthorization;
  const req = Readable.from([JSON.stringify(body)]);
  Object.assign(req, { method: 'POST', url: '/api/developer/question-review', socket: { remoteAddress: '127.0.0.1' }, headers: { authorization, host: hosted ? 'preview.vercel.app' : 'localhost:3001', origin: hosted ? 'https://preview.vercel.app' : 'http://localhost:5173', 'content-type': 'application/json' } });
  return new Promise(resolve => server.emit('request', req, { setHeader() {}, writeHead(status) { this.status = status; }, end(text) { resolve({ status: this.status, data: JSON.parse(text) }); } }));
}

test('question review endpoint validates input and supports hosted Anthropic admins', async t => {
  let calls = 0;
  const local = createApiServer({ accountService: testAccountService(), chatgpt: null, env: { ANTHROPIC_API_KEY: 'test-only' }, query: async () => { calls++; return makeReview(); } });
  const hosted = createApiServer({ accountService: testAccountService(), hosted: true, env: { VERCEL_URL: 'preview.vercel.app', ANTHROPIC_API_KEY: 'test-only' }, query: async () => makeReview() });
  t.after(() => { local.close(); hosted.close(); });
  const valid = { caseId: fixture.id, baseline, enhanced };
  assert.equal((await invoke(local, { ...valid, caseId: 'missing' })).status, 400);
  assert.equal((await invoke(local, { ...valid, enhanced: '' })).status, 400);
  assert.equal(calls, 0);
  const hostedResult = await invoke(hosted, valid, true);
  assert.equal(hostedResult.status, 200);
  assert.equal(hostedResult.data.provider, 'anthropic');
  const result = await invoke(local, valid);
  assert.equal(result.status, 200);
  assert.equal(result.data.questions.enhanced.total, 10);
  assert.equal(calls, 1);
});
