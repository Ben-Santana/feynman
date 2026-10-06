import { accessCookie } from './accessTestHelper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';

async function invoke(server, url, origin = 'https://preview.vercel.app', provider) {
  const cookie = await accessCookie(server, { host: 'preview.vercel.app', origin: 'https://preview.vercel.app' });
  const req = Readable.from([]);
  Object.assign(req, { method: 'GET', url, headers: { cookie, host: 'preview.vercel.app', origin, ...(provider ? { 'x-feynman-provider': provider } : {}) } });
  return new Promise(resolve => {
    const res = { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); } };
    server.emit('request', req, res);
  });
}

test('hosted backend serves prefixed API routes with explicit origins and no local capabilities', async t => {
  const server = createApiServer({ hosted: true, env: { VERCEL_URL: 'preview.vercel.app', APP_ORIGIN: 'https://learn.example.com' } });
  t.after(() => server.close());
  const catalog = await invoke(server, '/api/ai/providers');
  assert.equal(catalog.status, 200);
  assert.deepEqual(catalog.data.providers.map(item => item.id), ['anthropic']);
  assert.equal((await invoke(server, '/api/health', 'https://learn.example.com')).status, 200);
  assert.equal((await invoke(server, '/api/health', 'https://evil.example')).status, 403);
  assert.equal((await invoke(server, '/api/health', undefined, 'chatgpt')).status, 400);
  assert.equal((await invoke(server, '/api/developer/prompts')).status, 403);
  assert.equal((await invoke(server, '/api/ai/sign-in')).status, 403);
  assert.equal((await invoke(server, '/auth/callback')).status, 403);
  assert.equal((await invoke(server, '/health')).status, 404);
});
