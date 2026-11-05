import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { installGracefulShutdown } from './server.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function fixture(t, options = {}) {
  const entered = deferred(), release = deferred(), exited = deferred(), signals = new EventEmitter();
  const server = createServer(async (req, res) => {
    if (req.url === '/generate') { entered.resolve(); await release.promise; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ complete: true }));
  });
  let exits = 0;
  const dispose = installGracefulShutdown(server, { signals, exit(code) { exits++; exited.resolve(code); }, log() {}, ...options });
  t.after(() => { release.resolve(); dispose(); server.closeAllConnections(); server.close(() => {}); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, signals, entered, release, exited, exitCount: () => exits, url: `http://127.0.0.1:${server.address().port}` };
}
test('source reload drains active generation without dropping its response and still serves requests while waiting', async t => {
  const f = await fixture(t);
  const generation = fetch(`${f.url}/generate`);
  await f.entered.promise;
  f.signals.emit('SIGTERM');
  assert.equal(f.server.listening, true); assert.equal(f.exitCount(), 0);
  const other = await fetch(`${f.url}/health`); assert.deepEqual(await other.json(), { complete: true });
  assert.equal(f.exitCount(), 0, 'another request finishing must not cancel the active generation');
  f.release.resolve();
  const response = await generation;
  assert.deepEqual(await response.json(), { complete: true });
  assert.equal(await f.exited.promise, 0); assert.equal(f.server.listening, false); assert.equal(f.exitCount(), 1);
});
test('idle backend shuts down immediately instead of waiting for the whole grace period', async t => {
  const f = await fixture(t);
  f.signals.emit('SIGTERM');
  assert.equal(await f.exited.promise, 0); assert.equal(f.exitCount(), 1);
});
test('grace deadline bounds shutdown if an active request never completes', async t => {
  const f = await fixture(t, { graceMs: 40 });
  const generation = fetch(`${f.url}/generate`).then(response => response.text(), error => error);
  await f.entered.promise; f.signals.emit('SIGTERM');
  assert.equal(await f.exited.promise, 1); assert.ok(await generation instanceof Error); assert.equal(f.exitCount(), 1);
});
test('a second explicit signal can force a stuck development process to stop', async t => {
  const f = await fixture(t);
  const generation = fetch(`${f.url}/generate`).then(response => response.text(), error => error);
  await f.entered.promise; f.signals.emit('SIGINT'); f.signals.emit('SIGINT');
  assert.equal(await f.exited.promise, 1); assert.ok(await generation instanceof Error);
});

// Run the real transport function with a mocked accountFetch, without mounting
// React or loading browser account state. No provider/network call is involved.
const source = readFileSync(new URL('../../frontend/src/components/PuzzleGenerator.tsx', import.meta.url), 'utf8');
const transportSource = source.slice(source.indexOf('async function api<'), source.indexOf('\nexport function PuzzleGenerator'));
const javascript = ts.transpileModule(transportSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
const transport = new Function('accountFetch', 'aiHeaders', `${javascript}\nreturn api;`);
test('proxy/socket failures explain interruption without claiming the app is stopped or automatically repeating generation', async () => {
  for (const mock of [async () => { throw new TypeError('fetch failed'); }, async () => new Response('proxy connection reset', { status: 500 }), async () => new Response('null', { status: 502 })]) {
    let calls = 0;
    const api = transport((...args) => { calls++; return mock(...args); }, () => ({}));
    await assert.rejects(api({ description: 'A circuit puzzle' }), error => /interrupted/.test(error.message) && /description is kept/.test(error.message) && !/npm run dev/.test(error.message));
    assert.equal(calls, 1, 'failed POSTs must not be retried silently');
  }
});
test('transport retains provider/auth errors and timeout/cancel reasons', async () => {
  const auth = transport(async () => new Response(JSON.stringify({ error: 'Claude rejected the API key.' }), { status: 401 }), () => ({}));
  await assert.rejects(auth({ description: 'A circuit puzzle' }), /Claude rejected the API key/);
  const controller = new AbortController(), reason = new DOMException('Generation timed out.', 'TimeoutError');
  controller.abort(reason);
  const timedOut = transport(async () => { throw new TypeError('fetch failed'); }, () => ({}));
  await assert.rejects(timedOut({}, controller.signal), error => error === reason);
});
