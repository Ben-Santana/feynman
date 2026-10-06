import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';

function invoke(server, { method = 'GET', url = '/api/access', code, cookie, ip = '127.0.0.1', origin = 'https://preview.vercel.app' } = {}) {
  const req = Readable.from(code === undefined ? [] : [JSON.stringify({ code })]);
  Object.assign(req, { method, url, socket: { remoteAddress: ip }, headers: { host: 'preview.vercel.app', origin, ...(cookie ? { cookie } : {}) } });
  return new Promise(resolve => {
    const headers = {};
    server.emit('request', req, {
      setHeader(name, value) { headers[name.toLowerCase()] = value; },
      writeHead(status) { this.status = status; },
      end(body) { resolve({ status: this.status, data: JSON.parse(body), headers }); },
    });
  });
}

test('access code unlocks a signed session and gates direct API requests', async t => {
  const server = createApiServer({ hosted: true, env: { VERCEL_URL: 'preview.vercel.app' } });
  t.after(() => server.close());
  assert.deepEqual((await invoke(server)).data, { unlocked: false });
  for (const url of ['/api/health', '/api/ai/providers', '/api/chat', '/api/rubric']) {
    assert.equal((await invoke(server, { url, method: url === '/api/chat' || url === '/api/rubric' ? 'POST' : 'GET' })).status, 401);
  }
  assert.equal((await invoke(server, { method: 'POST', code: '1234' })).status, 401);
  assert.equal((await invoke(server, { method: 'POST', code: 6767 })).status, 401);
  const unlocked = await invoke(server, { method: 'POST', code: '6767' });
  assert.equal(unlocked.status, 200);
  assert.match(unlocked.headers['set-cookie'], /HttpOnly; SameSite=Strict; Max-Age=604800; Secure/);
  const cookie = unlocked.headers['set-cookie'].split(';')[0];
  assert.deepEqual((await invoke(server, { cookie })).data, { unlocked: true });
  assert.equal((await invoke(server, { cookie, url: '/api/ai/providers' })).status, 200);
  assert.equal((await invoke(server, { cookie: cookie + 'x', url: '/api/health' })).status, 401);
  assert.equal((await invoke(server, { cookie: cookie.replace(/=\d+\./, '=1.'), url: '/api/health' })).status, 401);
});

test('access rejects repeated guesses and untrusted origins', async t => {
  const server = createApiServer({ hosted: true, env: { VERCEL_URL: 'preview.vercel.app' } });
  t.after(() => server.close());
  assert.equal((await invoke(server, { method: 'POST', code: '6767', origin: 'https://untrusted.example' })).status, 403);
  for (let index = 0; index < 10; index++) assert.equal((await invoke(server, { method: 'POST', code: '0000' })).status, 401);
  assert.equal((await invoke(server, { method: 'POST', code: '6767' })).status, 429);
  assert.equal((await invoke(server, { method: 'POST', code: '6767', ip: 'other' })).status, 200);
});
