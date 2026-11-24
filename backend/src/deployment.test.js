import { testAccountService, testAuthorization } from './accessTestHelper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createProviderRegistry } from './providers/registry.js';
import { createApiServer } from './server.js';
import { readFileSync } from 'node:fs';

async function invoke(server, url, origin = 'https://preview.vercel.app', provider, { method = 'GET', authorization = testAuthorization, body, headers = {} } = {}) {
  const req = Readable.from(body !== undefined ? [JSON.stringify(body)] : method === 'POST' ? ['{}'] : []);
  Object.assign(req, { method, url, headers: { authorization, host: 'preview.vercel.app', origin, 'content-type': 'application/json', ...(provider ? { 'x-feynman-provider': provider } : {}), ...headers } });
  return new Promise(resolve => {
    const res = { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); } };
    server.emit('request', req, res);
  });
}

test('hosted backend serves prefixed API routes with explicit origins and no local capabilities', async t => {
  const server = createApiServer({ accountService: testAccountService(), hosted: true, env: { VERCEL_URL: 'preview.vercel.app', APP_ORIGIN: 'https://learn.example.com' } });
  t.after(() => server.close());
  const catalog = await invoke(server, '/api/ai/providers');
  assert.equal(catalog.status, 200);
  assert.deepEqual(catalog.data.providers.map(item => item.id), ['anthropic']);
  assert.equal((await invoke(server, '/api/health', 'https://learn.example.com')).status, 200);
  assert.equal((await invoke(server, '/api/health', 'https://evil.example')).status, 403);
  assert.equal((await invoke(server, '/api/health', undefined, 'chatgpt')).data.provider, 'anthropic');
  const prompts = await invoke(server, '/api/developer/prompts');
  assert.equal(prompts.status, 200);
  assert.equal(prompts.data.editable, false);
  assert.ok(prompts.data.prompts.some(prompt => prompt.id === 'chat.classroomRole' && prompt.text));
  assert.equal((await invoke(server, '/api/ai/sign-in')).status, 403);
  assert.equal((await invoke(server, '/auth/callback')).status, 403);
  assert.equal((await invoke(server, '/health')).status, 404);
});

test('hosted comparison routes require admin login and Anthropic without making unauthorized model calls', async t => {
  let calls = 0;
  const makeServer = role => createApiServer({ accountService: testAccountService(role), hosted: true, env: { VERCEL_URL: 'preview.vercel.app', ANTHROPIC_API_KEY: 'test-only' }, query: () => { calls++; throw new Error('Must not call model'); } });
  const admin = makeServer('admin');
  const student = makeServer('student');
  const instructor = makeServer('instructor');
  t.after(() => { admin.close(); student.close(); instructor.close(); });
  for (const url of ['/api/developer/question-comparison', '/api/developer/question-review', '/api/developer/evaluator-comparison']) {
    for (const method of ['GET', 'POST']) {
      assert.equal((await invoke(admin, url, undefined, undefined, { method, authorization: '' })).status, 401);
      for (const server of [student, instructor]) assert.equal((await invoke(server, url, undefined, undefined, { method })).status, 403);
    }
    assert.equal((await invoke(admin, url, 'https://evil.example', 'anthropic', { method: 'POST' })).status, 403);
  }
  assert.equal(calls, 0);
});

test('only admins can save a Claude model and hosted requests ignore browser selections', async t => {
  const env = { VERCEL_URL: 'preview.vercel.app', ANTHROPIC_API_KEY: 'test-only', ANTHROPIC_MODEL: 'claude-opus-default' };
  let model = '';
  const calls = [];
  const providers = createProviderRegistry({ env, fetcher: async (url, init) => {
    if (url.startsWith('https://api.anthropic.com/v1/models')) return Response.json({ data: [{ id: 'claude-opus-available', display_name: 'Claude Opus Available' }, { id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' }, { id: 'claude-fable-5-2', display_name: 'Claude Fable 5.2' }] });
    const input = JSON.parse(init.body);
    calls.push(input.model);
    return Response.json({ content: [{ type: 'tool_use', name: 'reply_to_teacher', input: { message: 'How would you explain energy?', expression: 'attentive' } }] });
  } });
  function makeServer(role) {
    const accountService = { ...testAccountService(role), getClaudeModel: async () => model, setClaudeModel: async (_account, value) => { model = value; } };
    const server = createApiServer({ hosted: true, env, providers, accountService });
    t.after(() => server.close());
    return server;
  }
  const admin = makeServer('admin');
  const student = makeServer('student');
  const path = '/api/admin/ai-model';
  const save = (server, model) => invoke(server, path, undefined, undefined, { method: 'PATCH', body: { model } });
  assert.equal((await invoke(student, path)).status, 403);
  assert.equal((await invoke(student, '/api/ai/models')).status, 403);
  assert.equal((await save(student, 'claude-opus-available')).status, 403);
  assert.equal((await save(admin, 'claude-opus-unavailable')).status, 400);
  for (const other of ['claude-sonnet-4-6', 'claude-fable-5-2']) assert.equal((await save(admin, other)).status, 400, 'Only Sonnet 5.5 and Opus models can be chosen.');
  assert.deepEqual((await invoke(admin, path)).data.models.map(item => item.slug), ['claude-opus-available', 'claude-sonnet-5-5']);
  assert.equal((await invoke(admin, path)).data.defaultModel, 'claude-opus-default');
  assert.equal((await save(admin, 'claude-opus-available')).status, 200);
  assert.equal((await invoke(admin, path)).data.model, 'claude-opus-available');
  const chat = await invoke(student, '/api/chat', undefined, 'chatgpt', {
    method: 'POST', headers: { 'x-feynman-model': 'claude-browser', 'x-feynman-account': 'saved-account' },
    body: { topic: 'Energy', level: 'apply', learningType: 'theoretical', aspects: ['Explains conservation of energy.'], messages: [] },
  });
  assert.equal(chat.status, 200);
  assert.deepEqual(calls, ['claude-opus-available']);
  assert.equal((await save(admin, '')).status, 200);
  assert.equal((await invoke(student, '/api/health')).data.model, 'claude-opus-default');
});

test('hosted function includes runtime comparison catalogs alongside prompts and consent assets', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const included = config.services.backend.functions['src/vercel.js'].includeFiles;
  for (const file of ['prompts.json', 'comparison-rubrics.json', 'question-strategies.json', 'strategy-comparison-cases.json', 'question-evaluation-results.json', 'assets/**']) assert.ok(included.includes(file), file);
});
