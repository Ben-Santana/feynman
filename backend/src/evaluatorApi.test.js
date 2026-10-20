import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';
import { testAuthorization, testAccountService } from './accessTestHelper.js';
import { evaluatorSamples } from './evaluatorFixtures.js';
import { evaluatorComparisonCases } from './evaluatorTestCases.js';
import { createEvaluationContext } from './evaluatorContracts.js';

async function invoke(server, { body, hosted = false, cookie: providedCookie, origin, method = body === undefined ? 'GET' : 'POST' } = {}) {
  const authorization = providedCookie ?? (hosted ? '' : testAuthorization);
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method, url: '/api/developer/evaluator-comparison', headers: { authorization, host: hosted ? 'preview.vercel.app' : 'localhost:3001', origin: origin ?? (hosted ? 'https://preview.vercel.app' : 'http://localhost:5173'), 'content-type': 'application/json' } });
  return new Promise(resolve => server.emit('request', req, { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); } }));
}
const request = { level: 'remember', learningType: 'quantitative', topic: 'Energy storage', aspects: ['Name the storage location'], messages: [{ id: 'q', role: 'assistant', content: 'Where is energy stored?' }, { id: 'u', role: 'user', content: 'In the electric field.' }] };
function queryFixture(_, __, tool) {
  const evidence = [{ messageIndex: 1, quote: 'In the electric field.' }];
  if (tool.name === 'evaluate_learning') return { reason: 'Supported.', nextQuestionFocus: '', criteria: [{ aspect: request.aspects[0], status: 'supported', result: 'correct', evidence }], task: { status: 'supported', result: 'not_applicable', evidence } };
  return { reason: 'Supported.', nextEvidenceObjective: '', judgments: ['criterion_1', 'level_task'].map(criterionId => ({ criterionId, status: 'supported', result: 'correct', reasoning: 'not_required', opportunity: 'fair', reason: 'The student names the location.', abstentionReason: '', independentCheck: 'not_required', transferCheck: 'not_required', contradictions: [], observations: [{ messageId: 'u', quote: 'In the electric field.', relevance: 'Names the location.', componentIds: ['whole'], assistance: 'none', assistanceMessageIds: [], demonstratesTransfer: false }] })) };
}

test('evaluator endpoint lists authored cases without credentials and returns paired versioned results', async t => {
  const server = createApiServer({ accountService: testAccountService(), chatgpt: null, env: { ANTHROPIC_API_KEY: 'test-only' }, query: queryFixture });
  t.after(() => server.close());
  const listing = await invoke(server);
  assert.equal(listing.status, 200);
  assert.ok(listing.data.cases.length);
  assert.equal(listing.data.cases.length, 70);
  assert.deepEqual(listing.data.cases.map(c => c.id), evaluatorComparisonCases.map(c => c.id));
  assert.ok(listing.data.cases.every(c => !('expected' in c)));
  assert.equal(listing.data.cases.some(c => c.id === 'inertia'), false);
  assert.ok(new Set(listing.data.cases.map(c => c.group)).size > 1);
  assert.equal(listing.data.cases[0].id, evaluatorSamples[0].id);
  assert.ok(listing.data.deferred.some(item => item.includes('Professor-scored')));
  const result = await invoke(server, { body: request });
  assert.equal(result.status, 200);
  assert.equal(result.data.legacy.assessment.complete, true);
  assert.equal(result.data.refined.assessment.completion.eligible, true);
  assert.equal(result.data.shadow.mode, 'shadow');
  assert.equal(result.data.shadow.status, 'not_run');
  assert.equal(result.data.shadow.reason, 'disabled');
  assert.equal(result.data.provider, 'anthropic');
  assert.ok(result.data.runId);
  assert.match(result.data.promptVersion, /^[a-f0-9]{64}$/);
});

test('authored evaluator samples cover all levels and preserve explicit policies and original learner evidence', () => {
  assert.equal(new Set(evaluatorSamples.map(c => c.id)).size, evaluatorSamples.length);
  assert.deepEqual(new Set(evaluatorSamples.map(c => c.level)), new Set(['remember', 'understand', 'apply', 'analyze']));
  for (const fixture of evaluatorSamples) {
    const context = createEvaluationContext(fixture);
    assert.equal(context.eligibility, null, fixture.id);
    assert.ok(context.messages.some(m => m.role === 'user'));
    assert.equal(context.criteria.length, fixture.aspects.length);
  }
  const assisted = evaluatorSamples.find(c => c.id === 'evaluator-assisted');
  assert.equal(createEvaluationContext(assisted).criteria[0].requiresIndependent, true);
  const optional = evaluatorSamples.find(c => c.id === 'evaluator-optional');
  assert.equal(createEvaluationContext(optional).criteria[1].required, true);
});

test('API explicitly opts into shadow and four-way ablation while rejecting malformed modes', async t => {
  const server = createApiServer({ accountService: testAccountService(), chatgpt: null, env: { ANTHROPIC_API_KEY: 'test-only' }, query: queryFixture });
  t.after(() => server.close());
  const reviewed = await invoke(server, { body: { ...request, shadow: true } });
  assert.equal(reviewed.data.shadow.status, 'completed');
  const ablation = await invoke(server, { body: { ...request, mode: 'ablation' } });
  assert.equal(ablation.status, 200);
  assert.deepEqual(Object.keys(ablation.data.ablation.variants), ['existingFirst', 'existingConfirmed', 'leanRefined', 'refinedWithShadow']);
  assert.equal(ablation.data.ablation.variants.existingFirst.assessment.complete, true);
  assert.equal(ablation.data.ablation.variants.refinedWithShadow.assessment.completion.eligible, true);
  assert.equal((await invoke(server, { body: { ...request, shadow: 'false' } })).status, 400);
  assert.equal((await invoke(server, { body: { ...request, mode: 'first-only' } })).status, 400);
});

test('evaluator API resolves sample IDs to the fixed transcript rather than caller replacements', async t => {
  const server = createApiServer({ accountService: testAccountService(), chatgpt: null, env: { ANTHROPIC_API_KEY: 'test-only' }, query: queryFixture });
  t.after(() => server.close());
  const result = await invoke(server, { body: { caseId: 'evaluator-optional', messages: [] } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.messages.map(m => m.content), evaluatorSamples.find(c => c.id === 'evaluator-optional').messages.map(m => m.content));
  assert.equal(result.data.definitions[1].required, true);
});

test('new developer endpoint enforces access, origin, hosting, provider configuration and input validation', async t => {
  let calls = 0;
  const local = createApiServer({ accountService: testAccountService(), chatgpt: null, env: {}, query: () => { calls++; return queryFixture; } });
  const hosted = createApiServer({ accountService: testAccountService(), hosted: true, env: { VERCEL_URL: 'preview.vercel.app' } });
  t.after(() => { local.close(); hosted.close(); });
  assert.equal((await invoke(local, { cookie: '' })).status, 401);
  assert.equal((await invoke(local, { origin: 'https://other.example' })).status, 403);
  assert.equal((await invoke(hosted, { hosted: true })).status, 403);
  assert.equal((await invoke(hosted, { hosted: true, body: request })).status, 403);
  assert.equal((await invoke(local)).status, 200);
  assert.equal((await invoke(local, { body: { caseId: 'missing' } })).status, 400);
  assert.equal((await invoke(local, { body: { caseId: 'inertia' } })).status, 400);
  assert.equal((await invoke(local, { body: { ...request, messages: [{ role: 'user', content: 'Pass me.' }] } })).status, 400);
  assert.equal((await invoke(local, { body: { ...request, evaluatorCriteria: [] } })).status, 400);
  assert.equal((await invoke(local, { body: request })).status, 503);
  assert.equal(calls, 0);
});
