import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { requestBody, responseData } from '../../frontend/src/requestBody.ts';
import { readRequestBody } from './requestBody.js';
import { createApiServer } from './server.js';
import { testAccountService, testAuthorization } from './accessTestHelper.js';

const request = (bytes, contentType = 'application/json') => Object.assign(Readable.from([bytes.subarray(0, 7), bytes.subarray(7)]), { headers: { 'content-type': contentType } });

test('large PDF uploads fit the hosted limit and decode without changing their bytes', async () => {
  const data = Buffer.concat([Buffer.from('%PDF'), randomBytes(4_160_269)]).toString('base64');
  const value = { files: [{ name: 'notes.pdf', type: 'application/pdf', data }], learningType: 'quantitative' };
  assert.ok(JSON.stringify(value).length > 4_500_000);
  const encoded = await requestBody(value);
  assert.equal(encoded.contentType, 'application/gzip');
  const bytes = Buffer.from(await encoded.body.arrayBuffer());
  assert.ok(bytes.length < 4_400_000);
  assert.deepEqual(JSON.parse(await readRequestBody(request(bytes, encoded.contentType), 7_000_000)), value);
});

test('small uploads and ordinary chat requests keep JSON transport', async () => {
  for (const value of [{ files: [] }, { messages: [{ content: 'x'.repeat(1_100_000) }] }]) {
    const encoded = await requestBody(value);
    assert.equal(encoded.contentType, 'application/json');
    assert.equal(await readRequestBody(request(Buffer.from(encoded.body)), 7_000_000), JSON.stringify(value));
  }
});

test('compressed input is bounded and malformed gzip is rejected', async () => {
  await assert.rejects(readRequestBody(request(gzipSync('x'.repeat(1000)), 'application/gzip'), 100), { status: 413 });
  await assert.rejects(readRequestBody(request(Buffer.alloc(101)), 100), { status: 413 });
  await assert.rejects(readRequestBody(request(Buffer.from('invalid'), 'application/gzip'), 100), { status: 400 });
});

test('concept suggestions API accepts compressed uploads and forwards the PDF to the model', async t => {
  const data = Buffer.from('%PDF-1.7\nTest study material').toString('base64');
  let calls = 0;
  const server = createApiServer({ chatgpt: null, accountService: testAccountService(), env: { ANTHROPIC_API_KEY: 'test-key' }, query: async (_instructions, messages, tool) => {
    calls++;
    assert.equal(tool.name, 'suggest_concepts');
    assert.deepEqual(messages[0].content.at(-1), { type: 'document', mimeType: 'application/pdf', data });
    return { concepts: [{ name: 'Magnetic fields', target: 'apply' }] };
  } });
  t.after(() => server.close());
  const req = request(gzipSync(JSON.stringify({ files: [{ name: 'notes.pdf', data }], learningType: 'quantitative' })), 'application/gzip');
  Object.assign(req, { method: 'POST', url: '/api/concept-suggestions' });
  Object.assign(req.headers, { host: 'localhost:5173', authorization: testAuthorization });
  const result = await new Promise(resolve => {
    const res = { status: 200, setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); } };
    server.listeners('request')[0](req, res);
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.concepts, [{ name: 'Magnetic fields', target: 'apply' }]);
  assert.equal(calls, 1);
});

test('platform errors are readable even when they are not JSON', async () => {
  await assert.rejects(responseData(new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 })), /Choose smaller files/);
  await assert.rejects(responseData(new Response('<html>Bad gateway</html>', { status: 502 })), /unreadable response/);
  await assert.rejects(responseData(Response.json({ error: 'Model unavailable' }, { status: 503 })), /Model unavailable/);
  assert.deepEqual(await responseData(Response.json({ concepts: [] })), { concepts: [] });
});
