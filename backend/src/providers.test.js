import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { LanguageModelProvider, AIError, createProviderQuery, invokeProvider } from './providers/LanguageModelProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { ChatGPTProvider } from './providers/ChatGPTProvider.js';
import { ProviderRegistry, createProviderRegistry } from './providers/registry.js';
import { createApiServer } from './server.js';
import { aiPreferences, aiHeaders, saveAIPreferences } from '../../frontend/src/aiPreferences.ts';

class TestProvider extends LanguageModelProvider {
  static metadata = { id: 'test-api', label: 'Test API', description: 'A third API.', configurationKind: 'api-key', configurationHelp: 'Set TEST_API_KEY.', configuredMessage: 'Test API configured.', supportsModelSelection: true, capabilities: { images: true, pdfs: true } };
  constructor({ model = 'test-default', configured = true, generate = async () => ({ message: 'Hello' }) } = {}) { super(); this.model = model || 'test-default'; this.configured = configured; this.generate = generate; }
  getStatus() { return { configured: this.configured, model: this.model, access_token: 'secret-status' }; }
  async listModels() { return [{ slug: 'test-default', name: 'Test default' }, { slug: 'test-selected', name: 'Test selected' }]; }
  async generateStructured(request) { return this.generate(request); }
}
const output = { name: 'respond_to_student', description: 'Return result.', schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'], additionalProperties: false } };
const messages = [{ role: 'user', content: [{ type: 'text', text: 'Study this' }, { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' }, { type: 'document', mimeType: 'application/pdf', data: 'cGRm' }] }];
const chatgpt = { accounts: () => [], close() {}, hasPendingRegistration: () => false };

test('the abstract contract rejects missing implementations and duplicate registrations', () => {
  assert.throws(() => new LanguageModelProvider(), /subclass/);
  class MissingProvider extends LanguageModelProvider { static metadata = TestProvider.metadata; }
  assert.throws(() => new ProviderRegistry().register(MissingProvider), /getStatus/);
  const registry = new ProviderRegistry().register(TestProvider);
  assert.throws(() => registry.register(TestProvider), /already registered/);
  assert.throws(() => registry.resolve('__proto__'), error => error instanceof AIError && error.status === 400);
});

test('structured generation forwards the neutral contract and rejects unsupported attachments before calling an API', async () => {
  let calls = 0;
  const generate = async request => {
    calls++;
    assert.equal(request.instructions, 'Instructions'); assert.deepEqual(request.messages, messages); assert.deepEqual(request.response, output);
    assert.ok(request.signal instanceof AbortSignal);
    return { message: 'Hello' };
  };
  assert.deepEqual(await createProviderQuery(new TestProvider({ generate }))('Instructions', messages, output), { message: 'Hello' });
  class TextProvider extends TestProvider { static metadata = { ...TestProvider.metadata, capabilities: { images: false, pdfs: false } }; }
  const provider = new TextProvider({ generate });
  for (const block of messages[0].content.slice(1)) {
    await assert.rejects(createProviderQuery(provider)('Instructions', [{ role: 'user', content: [block] }], output), error => error.status === 400 && /attachment type/.test(error.message));
  }
  await assert.rejects(createProviderQuery(new TestProvider({ generate }))('', [{ role: 'user', content: [{ type: 'document', mimeType: 'text/plain', data: 'aA==' }] }], output), /attachment type/);
  assert.equal(calls, 1);
});

test('both adapters translate neutral attachments and response schemas without exposing API shapes to learning code', async () => {
  const providers = [
    new AnthropicProvider({ env: { ANTHROPIC_API_KEY: 'test-key' }, fetcher: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.system, 'Instructions'); assert.deepEqual(body.tools[0].input_schema, output.schema);
      assert.deepEqual(body.messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } });
      assert.equal(body.messages[0].content[2].source.media_type, 'application/pdf');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: output.name, input: { message: 'Hello' } }] }));
    } }),
    new ChatGPTProvider({ runtime: { listModels: async () => [{ slug: 'test-model' }], accessToken: async () => 'test-token' }, fetcher: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.instructions, 'Instructions'); assert.deepEqual(body.tools[0].tools[0].parameters, output.schema);
      assert.equal(body.input[0].content[1].image_url, 'data:image/png;base64,aGVsbG8=');
      assert.equal(body.input[0].content[2].file_data, 'data:application/pdf;base64,cGRm');
      const item = { type: 'function_call', name: output.name, namespace: 'feynman', status: 'completed', arguments: JSON.stringify({ message: 'Hello' }) };
      const events = [{ type: 'response.output_item.done', output_index: 0, item }, { type: 'response.completed', response: { status: 'completed', output: [] } }];
      return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
    } }),
  ];
  for (const provider of providers) assert.deepEqual(await createProviderQuery(provider)('Instructions', messages, output), { message: 'Hello' });
});

test('common timeouts preserve long-request budgets and caller cancellation', async t => {
  const budgets = [];
  t.mock.method(AbortSignal, 'timeout', ms => { budgets.push(ms); return AbortSignal.abort(new DOMException('private detail', 'TimeoutError')); });
  const provider = new TestProvider({ generate: async () => { assert.fail('An aborted request must never call the provider'); } });
  for (const name of ['respond_to_student', 'extract_concepts', 'suggest_concepts', 'generate_rubric']) {
    await assert.rejects(createProviderQuery(provider)('', [], { ...output, name }), error => error.status === 504 && !error.message.includes('private detail'));
  }
  assert.deepEqual(budgets, [60_000, 180_000, 180_000, 180_000]);
  t.mock.restoreAll();
  await assert.rejects(invokeProvider(provider, { instructions: '', messages: [], response: output, signal: AbortSignal.abort() }), error => error.status === 504);
});

test('invalid structured data and unexpected errors produce safe failures; actionable AI errors retain status', async () => {
  for (const value of [null, [], 'text', 1]) {
    await assert.rejects(createProviderQuery(new TestProvider({ generate: async () => value }))('', [], output), /invalid structured data/);
  }
  await assert.rejects(createProviderQuery(new TestProvider({ generate: async () => { throw new Error('Bearer private-key'); } }))('', [], output), error => error.status === 502 && !error.message.includes('private-key'));
  const limit = new AIError('Provider usage limit reached.', 429);
  await assert.rejects(createProviderQuery(new TestProvider({ generate: async () => { throw limit; } }))('', [], output), error => error === limit);
});

async function invoke(server, { url = '/api/health', method = 'GET', body, provider = 'test-api', model = '', trace = false } = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method, url, headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json', ...(provider ? { 'x-feynman-provider': provider } : {}), 'x-feynman-model': model, ...(trace ? { 'x-feynman-trace': '1' } : {}) } });
  return new Promise(resolve => {
    const res = { status: 200, setHeader() {}, writeHead(status) { this.status = status; }, end(value) { resolve({ status: this.status, data: JSON.parse(value) }); } };
    server.listeners('request')[0](req, res);
  });
}

test('a third registered API supports discovery, health, models, rubric, and chat without server branches', async t => {
  const requests = [];
  const providers = createProviderRegistry({ chatgpt, env: { ANTHROPIC_API_KEY: 'private-key', ANTHROPIC_MODEL: 'configured-claude' } }).register(TestProvider, selection => new TestProvider({ ...selection, generate: async request => {
    requests.push(request);
    return request.response.name === 'generate_rubric' ? { items: ['Explains conservation of energy.'] } : { message: 'How would you explain this scenario?', expression: 'attentive' };
  } }));
  const server = createApiServer({ chatgpt, providers }); t.after(() => server.close());
  const discovery = await invoke(server, { url: '/api/ai/providers', provider: 'removed-api' });
  assert.equal(discovery.status, 200);
  assert.deepEqual(discovery.data.providers.map(item => item.id), ['chatgpt', 'anthropic', 'test-api']);
  assert.ok(!JSON.stringify(discovery).includes('private-key')); assert.ok(!JSON.stringify(discovery).includes('secret-status'));
  const health = await invoke(server, { model: 'test-selected' });
  assert.equal(health.data.configured, true); assert.equal(health.data.model, 'test-selected'); assert.equal(health.data.provider, 'test-api'); assert.equal(health.data.anthropicConfigured, true);
  assert.deepEqual((await invoke(server, { url: '/api/ai/models' })).data.models, await new TestProvider().listModels());
  const rubric = await invoke(server, { method: 'POST', url: '/api/developer/rubric', body: { topic: 'Energy', level: 'understand', learningType: 'theoretical' } });
  assert.equal(rubric.status, 200); assert.deepEqual(rubric.data.items, ['Explains conservation of energy.']);
  const chat = await invoke(server, { method: 'POST', url: '/api/chat', body: { topic: 'Energy', level: 'apply', learningType: 'theoretical', aspects: ['Explains conservation of energy.'], messages: [] } });
  assert.equal(chat.status, 200); assert.equal(chat.data.message, 'How would you explain this scenario?');
  assert.deepEqual(requests.map(request => request.response.name), ['generate_rubric', 'respond_to_student']);
  assert.equal((await invoke(server, { provider: '' })).data.provider, 'anthropic');
  assert.equal((await invoke(server, { provider: 'removed-api' })).status, 400);
  assert.equal(requests.length, 2);
});

test('unconfigured registered APIs return their configuration help before inference', async t => {
  const providers = new ProviderRegistry().register(TestProvider, () => new TestProvider({ configured: false, generate: async () => assert.fail('Must not call the provider') }));
  const server = createApiServer({ chatgpt, providers }); t.after(() => server.close());
  const response = await invoke(server, { method: 'POST', url: '/api/developer/rubric', body: { topic: 'Energy', level: 'understand' } });
  assert.equal(response.status, 503); assert.equal(response.data.error, 'Set TEST_API_KEY.');
});

test('browser preferences preserve existing and third-party provider IDs and never substitute an unavailable provider', t => {
  const saved = new Map();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent() {} } });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
  });
  assert.equal(aiPreferences().provider, 'chatgpt');
  for (const provider of ['chatgpt', 'anthropic', 'test-api', 'removed-api']) {
    const prefs = { provider, accountId: 'saved-account', model: 'saved-model' };
    saveAIPreferences(prefs); assert.deepEqual(aiPreferences(), prefs);
    assert.equal(aiHeaders()['X-Feynman-Provider'], provider); assert.equal(aiHeaders()['X-Feynman-Model'], 'saved-model');
  }
});

const callClaude = (...args) => createProviderQuery(new AnthropicProvider())(...args);

test('new Claude models use automatic tool choice and still reject missing structured results', async () => {
  for (const model of ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-mythos-5-1', 'claude-sonnet-4-6']) {
    const automatic = model !== 'claude-sonnet-4-6';
    const provider = new AnthropicProvider({ model, fetcher: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.tool_choice, automatic ? { type: 'auto' } : { type: 'tool', name: 'test' });
      if (automatic) assert.match(body.system, /calling test exactly once/);
      return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name: 'test', input: { message: 'Hi' } }] }) };
    } });
    const request = { instructions: 'system', messages: [], response: { name: 'test', schema: { type: 'object' } } };
    assert.deepEqual(await provider.generateStructured(request), { message: 'Hi' });
    provider.fetcher = async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'Hi' }] }) });
    await assert.rejects(provider.generateStructured(request), /incomplete response/);
  }
});

test('Claude transport maps auth failures and rejects truncated responses', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Unauthorized' } }) });
    await assert.rejects(callClaude('system', [], { name: 'test' }), /rejected the API key/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', name: 'test', input: {} }] }) });
    await assert.rejects(callClaude('system', [], { name: 'test' }), /incomplete response/);
  } finally { globalThis.fetch = original; }
});

test('rubric generation reports a useful timeout error', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); };
    await assert.rejects(callClaude('system', [], { name: 'extract_concepts' }), /Rubric generation took too long/);
  } finally { globalThis.fetch = original; }
});

test('workspace header is sent only when configured; missing scope gets actionable error', async () => {
  const originalFetch = globalThis.fetch;
  const originalWorkspace = process.env.ANTHROPIC_WORKSPACE_ID;
  try {
    for (const workspace of ['', ' workspace-test ']) {
      process.env.ANTHROPIC_WORKSPACE_ID = workspace;
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.headers['anthropic-workspace-id'], workspace.trim() || undefined);
        return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name: 'test', input: { message: 'Hi' } }] }) };
      };
      await callClaude('system', [], { name: 'test' });
    }
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'This key requires the anthropic-workspace-id header.' } }) });
    await assert.rejects(callClaude('system', [], { name: 'test' }), /Set ANTHROPIC_WORKSPACE_ID/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWorkspace === undefined) delete process.env.ANTHROPIC_WORKSPACE_ID;
    else process.env.ANTHROPIC_WORKSPACE_ID = originalWorkspace;
  }
});


test('Claude discovers models across pages with workspace credentials and uses the selected model', async () => {
  const env = { ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_WORKSPACE_ID: ' workspace ', ANTHROPIC_MODEL: 'configured-default' };
  const catalog = [{ slug: 'claude-one', name: 'Claude One' }, { slug: 'claude-two', name: 'Claude Two' }];
  const fetcher = async (url, options) => {
    assert.equal(options.headers['x-api-key'], 'test-key');
    assert.equal(options.headers['anthropic-workspace-id'], 'workspace');
    if (url.includes('/models')) {
      const second = new URL(url).searchParams.get('after_id') === 'claude-one';
      return Response.json({ data: [{ id: second ? 'claude-two' : 'claude-one', display_name: second ? 'Claude Two' : 'Claude One' }], has_more: !second, last_id: second ? 'claude-two' : 'claude-one' });
    }
    assert.equal(JSON.parse(options.body).model, 'claude-two');
    return Response.json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: output.name, input: { message: 'Selected Claude' } }] });
  };
  const registry = createProviderRegistry({ chatgpt, env, fetcher });
  assert.equal(registry.describe().find(item => item.id === 'anthropic').supportsModelSelection, true);
  assert.equal(registry.resolve('anthropic').getStatus().model, 'configured-default');
  const provider = registry.resolve('anthropic', { model: 'claude-two' });
  assert.deepEqual(await provider.listModels(), catalog);
  assert.deepEqual(await createProviderQuery(provider)('Instructions', messages, output), { message: 'Selected Claude' });
});

test('Claude model discovery reports authentication failures and missing configuration', async () => {
  await assert.rejects(new AnthropicProvider({ env: {} }).listModels(), error => error.status === 400);
  await assert.rejects(new AnthropicProvider({ env: { ANTHROPIC_API_KEY: 'test-key' }, fetcher: async () => new Response('', { status: 401 }) }).listModels(), error => error.status === 401 && /API key/.test(error.message));
});


test('conversation tracing includes actual calls and preserves failed calls only when requested', async t => {
  let fail = false;
  const providers = createProviderRegistry({ chatgpt, env: {} }).register(TestProvider, () => new TestProvider());
  const server = createApiServer({ chatgpt, providers, query: async () => {
    if (fail) throw new AIError('Model unavailable.', 503);
    return { message: 'Explain your prediction?', expression: 'confused' };
  } });
  t.after(() => server.close());
  const body = { topic: 'Energy', level: 'apply', learningType: 'theoretical', aspects: ['Explains energy.'], messages: [] };
  const plain = await invoke(server, { url: '/api/chat', method: 'POST', body });
  assert.equal(plain.data.calls, undefined);
  const traced = await invoke(server, { url: '/api/chat', method: 'POST', body, trace: true });
  assert.equal(traced.status, 200);
  assert.equal(traced.data.calls.length, 1);
  const call = traced.data.calls[0];
  assert.equal(call.role, 'learner');
  assert.ok(call.request.instructions.includes('Energy'));
  assert.ok(call.request.messages.length);
  assert.equal(call.request.response.name, 'respond_to_student');
  assert.deepEqual(call.response, { message: 'Explain your prediction?', expression: 'confused' });
  assert.ok(call.durationMs >= 0);
  fail = true;
  const failed = await invoke(server, { url: '/api/chat', method: 'POST', body, trace: true });
  assert.equal(failed.status, 503);
  assert.equal(failed.data.calls[0].error, 'Model unavailable.');
  assert.ok(failed.data.calls[0].request.instructions);
});
