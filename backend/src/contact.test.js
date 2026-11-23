import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';
import { AccountError, createAccountService } from './accounts.js';
import { createRateLimiter, parseContactMessage } from './contact.js';

function invoke(server, { method = 'POST', url = '/api/contact', body, authorization, address = '203.0.113.7' } = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method, url, socket: { remoteAddress: address }, headers: { host: 'localhost:5173', origin: 'http://localhost:5173', ...(authorization ? { authorization } : {}) } });
  return new Promise(resolve => server.emit('request', req, {
    setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); },
  }));
}
const valid = { name: 'Ada Lovelace', email: 'Ada@Example.com', message: 'How do I join the study?' };

test('contact messages are cleaned and validated', () => {
  assert.deepEqual(parseContactMessage({ ...valid, name: '  Ada\n Lovelace ', message: 'Line one\r\nLine two\u0000' }).value, { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Line one\nLine two' });
  assert.equal(parseContactMessage({ ...valid, name: ' ' }).error, 'Enter your name.');
  assert.equal(parseContactMessage({ ...valid, email: 'not-an-email' }).error, 'Enter a valid email address.');
  assert.equal(parseContactMessage({ ...valid, message: 'x'.repeat(4001) }).error, 'Keep your message under 4000 characters.');
  assert.equal(parseContactMessage([]).error, 'Fill in your name, email, and message.');
  assert.deepEqual(parseContactMessage({ ...valid, website: 'https://spam.example' }), { spam: true });
});

test('rate limiter allows a fixed number of attempts per window', () => {
  let time = 0;
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => time });
  assert.equal(limiter.take('a'), true);
  assert.equal(limiter.take('a'), true);
  assert.equal(limiter.take('a'), false);
  assert.equal(limiter.take('b'), true);
  time = 1001;
  assert.equal(limiter.take('a'), true);
});

test('signed-out visitors can send a contact message without seeing its destination', async t => {
  const saved = [];
  const server = createApiServer({ accountService: { async getClaudeModel() { return ''; }, async authenticate() { throw new AccountError('Sign in to your account.'); }, async submitContactMessage(message) { saved.push(message); } } });
  t.after(() => server.close());
  const sent = await invoke(server, { body: valid });
  assert.deepEqual(sent, { status: 201, data: { sent: true } });
  assert.deepEqual(saved, [{ name: 'Ada Lovelace', email: 'ada@example.com', message: 'How do I join the study?' }]);
  assert.ok(!JSON.stringify(sent).includes('wpi.edu'));
  assert.equal((await invoke(server, { body: { ...valid, email: 'nope' } })).status, 400);
  assert.equal((await invoke(server, { body: { ...valid, website: 'bot' } })).status, 201);
  assert.equal(saved.length, 1);
  assert.equal((await invoke(server, { method: 'GET' })).status, 405);
  // Five attempts per visitor per hour, counting rejected ones.
  for (let attempt = 4; attempt <= 5; attempt++) assert.equal((await invoke(server, { body: valid })).status, 201);
  assert.equal((await invoke(server, { body: valid })).status, 429);
  assert.equal((await invoke(server, { body: valid, address: '198.51.100.2' })).status, 201);
});

test('only the configured admin inbox lists and deletes contact messages', async t => {
  const message = { id: '44444444-4444-4444-8444-444444444444', name: 'Ada', email: 'ada@example.com', message: 'Hello', created_at: '2026-11-22T00:00:00Z' };
  const calls = [];
  function factory() {
    return {
      from(table) {
        const query = {
          select() { return query; }, order() { return query; }, eq(column, value) { calls.push({ table, eq: [column, value] }); return query; },
          delete() { calls.push({ table, delete: true }); return query; },
          async limit() { return { data: [message], error: null }; },
          then(resolve) { resolve({ error: null }); },
        };
        return query;
      },
      async rpc(name) { return { data: name === 'course_invitations' ? [] : { users: [], total: 0, page: 1, pageSize: 25 }, error: null }; },
    };
  }
  const service = createAccountService({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: 'secret', CONTACT_INBOX_EMAIL: 'other@wpi.edu' }, factory);
  // The inbox is fixed in code; the environment variable above must have no effect.
  const owner = { id: '11111111-1111-4111-8111-111111111111', email: 'BASantana@wpi.edu', role: 'admin' };
  const otherAdmin = { ...owner, email: 'other@wpi.edu' };
  const ownerInbox = await service.inbox(owner, new URLSearchParams(), { headers: {} });
  assert.deepEqual(ownerInbox.messages.map(item => item.contact?.id), [message.id]);
  assert.equal(ownerInbox.total, 1);
  const otherInbox = await service.inbox(otherAdmin, new URLSearchParams(), { headers: {} });
  assert.ok(!otherInbox.messages.some(item => item.contact));
  await assert.rejects(service.deleteContactMessage(otherAdmin, message.id), { status: 403 });
  await assert.rejects(service.deleteContactMessage(owner, 'bad-id'), { status: 400 });
  await service.deleteContactMessage(owner, message.id);
  assert.ok(calls.some(call => call.table === 'contact_messages' && call.delete));
  assert.ok(calls.some(call => call.table === 'contact_messages' && call.eq?.[1] === message.id));
});

test('contributor avatars are public, keyed by slug, and never include emails', async t => {
  const server = createApiServer({ accountService: { async getClaudeModel() { return ''; }, async authenticate() { throw new AccountError('Sign in to your account.'); },
    async contributorAppearances() { return { ben: { color: 'mint', shape: 'flower' }, leo: null, koksal: null }; } } });
  t.after(() => server.close());
  const result = await invoke(server, { method: 'GET', url: '/api/contributors' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.avatars, { ben: { color: 'mint', shape: 'flower' }, leo: null, koksal: null });
  assert.ok(!JSON.stringify(result.data).includes('@'));
});

test('contributor appearances are matched to accounts by email, ignoring case', async () => {
  const rows = {
    profiles: [{ id: 'b', email: 'BASantana@wpi.edu' }, { id: 'k', email: 'kmus@wpi.edu' }],
    user_customizations: [{ user_id: 'b', appearance: { color: 'mint' } }],
  };
  const factory = () => ({ from(table) { const query = { select() { return query; }, or() { return Promise.resolve({ data: rows[table], error: null }); }, in() { return Promise.resolve({ data: rows[table], error: null }); } }; return query; } });
  const service = createAccountService({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: 'secret' }, factory);
  assert.deepEqual(await service.contributorAppearances(), { koksal: null, leo: null, ben: { color: 'mint' } });
});
