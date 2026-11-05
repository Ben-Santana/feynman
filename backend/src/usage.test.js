import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { usageCost, usageRecord } from './usage.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { createProviderQuery } from './providers/LanguageModelProvider.js';

test('cost includes output and both cache durations; unknown models stay unpriced', () => {
  assert.equal(usageCost('claude-sonnet-4-6', { input_tokens: 1000000, output_tokens: 1000000, cache_read_input_tokens: 1000000, cache_creation_input_tokens: 2000000, cache_creation: { ephemeral_1h_input_tokens: 1000000 } }), 28.05);
  assert.equal(usageCost('claude-future-model', { input_tokens: 100 }), null);
  assert.equal(usageRecord({ userId: 'x', feature: 'Chat', operation: 'respond', provider: 'chatgpt', model: 'x', usage: { input_tokens: 12, output_tokens: 5 } }).cost_usd, null);
  const missing = usageRecord({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  assert.equal(missing.cost_usd, null); assert.equal(missing.usage_reported, false);
});

test('provider reports billed usage even when structured output is incomplete', async () => {
  const events = [];
  const provider = new AnthropicProvider({ env: { ANTHROPIC_API_KEY: 'test' }, fetcher: async () => ({ ok: true, json: async () => ({ model: 'claude-sonnet-4-6', usage: { input_tokens: 200, output_tokens: 30 }, stop_reason: 'max_tokens', content: [] }) }) });
  await assert.rejects(createProviderQuery(provider)('', [], { name: 'test' }, { onUsage: event => events.push(event) }), /incomplete/);
  assert.equal(events.length, 1); assert.equal(events[0].usage.output_tokens, 30);
});

test('usage SQL reconciles daily, feature and user totals, filters users, and protects access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table profiles(id uuid primary key, display_name text, email text, approved boolean);
      create table user_roles(user_id uuid, role text);
      insert into profiles values ('00000000-0000-0000-0000-000000000001','Admin','a@example.test',true),('00000000-0000-0000-0000-000000000002','Student','s@example.test',true);
      insert into user_roles values ('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','student');`);
    await db.exec(await readFile(new URL('../../supabase/migrations/202610260001_ai_usage.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into ai_usage_events(user_id, feature, operation, provider, model, input_tokens, output_tokens, cost_usd, usage_reported) values
      ('00000000-0000-0000-0000-000000000001','Rubric generation','rubric','anthropic','claude-sonnet-4-6',100,50,.012,true),
      ('00000000-0000-0000-0000-000000000002','Learning sessions','chat','anthropic','claude-sonnet-4-6',200,50,.023,true),
      ('00000000-0000-0000-0000-000000000002','Learning sessions','chat','chatgpt','unknown',300,50,null,true);`);
    const report = async (user = null) => (await db.query('select admin_usage_analytics($1, 7, $2) as data', ['00000000-0000-0000-0000-000000000001', user])).rows[0].data;
    const all = await report();
    assert.equal(all.daily.length, 7); assert.equal(all.totals.tokens, 750); assert.equal(all.totals.calls, 3); assert.equal(all.totals.cost, .035); assert.equal(all.totals.unpriced, 1);
    for (const rows of [all.daily, all.users, all.features]) {
      assert.equal(rows.reduce((sum, row) => sum + row.tokens, 0), all.totals.tokens);
      assert.ok(Math.abs(rows.reduce((sum, row) => sum + Number(row.cost), 0) - all.totals.cost) < 1e-8);
    }
    const student = await report('00000000-0000-0000-0000-000000000002');
    assert.equal(student.totals.tokens, 600); assert.equal(student.features.length, 1); assert.equal(student.users.length, 2);
    await assert.rejects(db.query('select admin_usage_analytics($1)', ['00000000-0000-0000-0000-000000000002']), /Admin access required/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from ai_usage_events'), /permission denied/);
    await assert.rejects(db.query("select admin_usage_analytics('00000000-0000-0000-0000-000000000001')"), /permission denied/);
  } finally { await db.close(); }
});

test('HTTP reporting is admin-only and model calls retain authenticated attribution', async () => {
  const { Readable } = await import('node:stream');
  const { createApiServer } = await import('./server.js');
  const { testAccountService, testAuthorization } = await import('./accessTestHelper.js');
  async function request(server, url, method = 'GET', body) {
    const req = Readable.from(body ? [JSON.stringify(body)] : []);
    Object.assign(req, { url, method, headers: { host: 'localhost:5173', authorization: testAuthorization } });
    return new Promise(resolve => server.listeners('request')[0](req, { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }); } }));
  }
  const records = [];
  const accountService = { ...testAccountService(), recordUsage: async row => records.push(row), usageAnalytics: async () => ({ protected: true }) };
  const providers = { resolve: () => ({ metadata: { configurationHelp: 'Configure AI.' }, getStatus: () => ({ configured: true, model: 'configured-model' }) }) };
  const server = createApiServer({ accountService, providers, chatgpt: null, query: async (_instructions, _messages, response, options) => {
    await options.onUsage({ model: 'claude-sonnet-4-6', usage: { input_tokens: 100, output_tokens: 50 } });
    return { items: ['Explains conservation of energy.'] };
  } });
  try {
    assert.equal((await request(server, '/api/admin/usage')).body.protected, true);
    assert.equal((await request(server, '/api/developer/rubric', 'POST', { topic: 'Energy', level: 'understand', learningType: 'theoretical', user_id: 'spoofed' })).status, 200);
    assert.equal(records.length, 1);
    assert.equal(records[0].user_id, '11111111-1111-4111-8111-111111111111');
    assert.equal(records[0].feature, 'Rubric testing');
    assert.equal(records[0].operation, 'generate_rubric');
    assert.equal(records[0].model, 'claude-sonnet-4-6');
    assert.equal(records[0].cost_usd, .00105);
    const denied = createApiServer({ accountService: { ...testAccountService('student'), usageAnalytics: () => assert.fail('Students must not reach reports') }, chatgpt: null });
    try { assert.equal((await request(denied, '/api/admin/usage')).status, 403); } finally { denied.close(); }
  } finally { server.close(); }
});
