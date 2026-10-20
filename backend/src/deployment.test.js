import { testAccountService, testAuthorization } from './accessTestHelper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';
import { readFileSync } from 'node:fs';

async function invoke(server, url, origin = 'https://preview.vercel.app', provider, { method = 'GET', authorization = testAuthorization } = {}) {
  const req = Readable.from(method === 'POST' ? ['{}'] : []);
  Object.assign(req, { method, url, headers: { authorization, host: 'preview.vercel.app', origin, 'content-type': 'application/json', ...(provider ? { 'x-feynman-provider': provider } : {}) } });
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
  assert.equal((await invoke(server, '/api/health', undefined, 'chatgpt')).status, 400);
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
    const blocked = await invoke(admin, url, undefined, 'chatgpt', { method: 'POST' });
    assert.equal(blocked.status, 403);
    assert.match(blocked.data.error, /Choose Anthropic/);
    assert.equal((await invoke(admin, url, 'https://evil.example', 'anthropic', { method: 'POST' })).status, 403);
  }
  assert.equal(calls, 0);
});

test('hosted function includes runtime comparison catalogs alongside prompts and consent assets', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const included = config.services.backend.functions['src/vercel.js'].includeFiles;
  for (const file of ['prompts.json', 'comparison-rubrics.json', 'question-strategies.json', 'strategy-comparison-cases.json', 'question-evaluation-results.json', 'assets/**']) assert.ok(included.includes(file), file);
});
