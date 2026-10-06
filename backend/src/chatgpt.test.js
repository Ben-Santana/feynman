import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { generateKeyPair, SignJWT } from 'jose';
import { createChatGPT, createSignInAttempt } from './chatgpt.js';
import { ChatGPTProvider, readResponseStream, responseInput } from './providers/ChatGPTProvider.js';
import { createProviderQuery } from './providers/LanguageModelProvider.js';
import { createApiServer } from './server.js';

const chatGPTQuery = (runtime, accountId, model, fetcher) => createProviderQuery(new ChatGPTProvider({ runtime, accountId, model, fetcher }));

const issuer = 'https://auth.openai.com';
const clientId = 'oaiapp_test';
const redirectUri = 'http://127.0.0.1:1455/auth/callback';
const keyPair = await generateKeyPair('RS256');
const ok = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const baseTokens = { access_token: 'access-secret', refresh_token: 'refresh-secret', token_type: 'Bearer', expires_in: 3600, scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct' };
function fixture(t, fetcher) {
  const directory = mkdtempSync(join(tmpdir(), 'feynman-chatgpt-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, runtime: createChatGPT({ directory, fetcher, keys: keyPair.publicKey }) };
}
async function tokensFor(attempt, claims = {}, extra = {}) {
  const id_token = await new SignJWT({ email: 'person@example.com', nonce: attempt.nonce, ...claims }).setProtectedHeader({ alg: 'RS256' }).setIssuer(issuer).setAudience(clientId).setSubject('user-1').setIssuedAt().setExpirationTime('1h').sign(keyPair.privateKey);
  return { ...baseTokens, id_token, ...extra };
}
const callback = (attempt, extra = {}) => `${redirectUri}?${new URLSearchParams({ state: attempt.state, code: 'code', client_id: clientId, ...extra })}`;

test('invalid grant retains registration for fresh authorization without trusting an unverified identity', async t => {
  let attempt;
  let reject = true;
  const { runtime, directory } = fixture(t, async () => reject
    ? new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'private upstream detail' }), { status: 400 })
    : ok(await tokensFor(attempt)));
  const started = await runtime.beginSignIn(undefined, redirectUri);
  attempt = JSON.parse(readFileSync(join(directory, 'accounts.json'))).attempts[0];
  await assert.rejects(runtime.handleCallback(callback(attempt)), error => error.status === 400 && error.oauthCode === 'invalid_grant' && !error.message.includes('private upstream detail'));
  assert.deepEqual(runtime.accounts(), []);
  const restored = createChatGPT({ directory, fetcher: async () => ok(await tokensFor(attempt)), keys: keyPair.publicKey });
  const retried = await restored.beginSignIn(undefined, redirectUri);
  const params = new URL(retried.url).searchParams;
  assert.equal(params.get('client_id'), clientId);
  assert.equal(params.get('agent_name_hint'), null);
  assert.notEqual(params.get('state'), new URL(started.url).searchParams.get('state'));
  const otherWorkspace = await restored.beginSignIn(undefined, redirectUri, { newRegistration: true });
  assert.equal(new URL(otherWorkspace.url).searchParams.get('client_id'), 'dynamic_agent_client');
  await restored.beginSignIn(undefined, redirectUri);
  attempt = JSON.parse(readFileSync(join(directory, 'accounts.json'))).attempts.at(-1);
  await assert.rejects(restored.handleCallback(callback(attempt, { client_id: 'oaiapp_different' })), /expected client/);
  await restored.beginSignIn(undefined, redirectUri);
  attempt = JSON.parse(readFileSync(join(directory, 'accounts.json'))).attempts.at(-1);
  const returning = new URL(callback(attempt)); returning.searchParams.delete('client_id');
  await restored.handleCallback(returning.href);
  assert.equal(restored.accounts()[0].connected, true);
  assert.equal(JSON.parse(readFileSync(join(directory, 'accounts.json'))).retryClientId, undefined);
});

test('token exchange errors preserve HTTP status and safe diagnostics without exposing upstream text', async t => {
  const { attempt } = createSignInAttempt('urn:uuid:host', redirectUri);
  const { runtime } = fixture(t, async () => new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'secret code access-secret' } }), { status: 429, headers: { 'x-request-id': 'request-test' } }));
  await assert.rejects(runtime.completeSignIn(callback(attempt), attempt), error => error.status === 429 && error.message.includes('rate_limit_exceeded') && error.message.includes('request-test') && !error.message.includes('access-secret'));
});

test('dynamic registration uses fresh PKCE, nonce, stable host ID, and explicit plan scopes', () => {
  const first = createSignInAttempt('urn:uuid:host', redirectUri);
  const second = createSignInAttempt('urn:uuid:host', redirectUri);
  const params = new URL(first.url).searchParams;
  assert.equal(params.get('client_id'), 'dynamic_agent_client');
  assert.equal(params.get('ext_agent_host_id'), 'urn:uuid:host');
  assert.equal(params.get('agent_name_hint'), 'Feynman');
  assert.equal(params.get('resource'), 'https://api.openai.com/v1');
  assert.equal(params.get('redirect_uri'), redirectUri);
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.match(params.get('scope'), /chatgpt.tokens.use.direct/);
  assert.notEqual(first.attempt.state, second.attempt.state);
  assert.notEqual(first.attempt.verifier, second.attempt.verifier);
  assert.notEqual(first.attempt.nonce, second.attempt.nonce);
  assert.ok(!first.url.includes(first.attempt.verifier));
});

test('verified sign-in stores owner-only credentials and public account metadata contains no tokens', async t => {
  const { attempt } = createSignInAttempt('urn:uuid:host', redirectUri);
  const tokens = await tokensFor(attempt);
  const { runtime, directory } = fixture(t, async (url, options) => {
    assert.equal(url, `${issuer}/api/accounts/oauth/token`);
    const fields = new URLSearchParams(options.body);
    assert.equal(fields.get('client_id'), clientId);
    assert.equal(fields.get('code_verifier'), attempt.verifier);
    assert.equal(fields.get('redirect_uri'), redirectUri);
    assert.equal(fields.get('client_secret'), null);
    return ok(tokens);
  });
  await runtime.completeSignIn(callback(attempt), attempt);
  assert.equal(await runtime.accessToken(clientId), baseTokens.access_token);
  assert.equal(statSync(join(directory, 'accounts.json')).mode & 0o777, 0o600);
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  const metadata = JSON.stringify(runtime.accounts());
  for (const token of [tokens.id_token, tokens.access_token, tokens.refresh_token]) assert.ok(!metadata.includes(token));
  assert.equal(runtime.accounts()[0].email, 'person@example.com');
  const restored = createChatGPT({ directory, fetcher: async () => { throw new Error('Unexpected network'); }, keys: keyPair.publicKey });
  assert.equal(await restored.accessToken(clientId), baseTokens.access_token);
  await assert.rejects(runtime.completeSignIn(callback(attempt), attempt), /expired/);
});

test('state, expiry, denied permission, and missing issued client fail before code exchange', async t => {
  let calls = 0;
  const { runtime } = fixture(t, async () => { calls++; throw new Error('Must not fetch'); });
  for (const change of ['state', 'expiry', 'denied', 'client']) {
    const { attempt } = createSignInAttempt('host', redirectUri);
    let url = callback(attempt);
    if (change === 'state') url = callback(attempt, { state: 'wrong' });
    if (change === 'expiry') attempt.expiresAt = 0;
    if (change === 'denied') url = callback(attempt, { error: 'access_denied' });
    if (change === 'client') url = callback(attempt, { client_id: 'dynamic_agent_client' });
    await assert.rejects(runtime.completeSignIn(url, attempt));
  }
  assert.equal(calls, 0);
  assert.deepEqual(runtime.accounts(), []);
});

test('pending authorization survives a backend restart and callbacks remain one-time', async t => {
  let tokens;
  const { runtime, directory } = fixture(t, async () => ok(tokens));
  const started = await runtime.beginSignIn(undefined, redirectUri);
  const state = new URL(started.url).searchParams.get('state');
  const saved = JSON.parse(readFileSync(join(directory, 'accounts.json')));
  const attempt = saved.attempts.find(item => item.state === state);
  assert.ok(attempt.verifier);
  assert.ok(!started.url.includes(attempt.verifier));
  tokens = await tokensFor(attempt);
  const restored = createChatGPT({ directory, fetcher: async () => ok(tokens), keys: keyPair.publicKey });
  await assert.rejects(restored.handleCallback(callback(attempt).replace(':1455/', ':1456/')), /Invalid or expired/);
  await restored.handleCallback(callback(attempt));
  assert.equal(restored.accounts()[0].connected, true);
  await assert.rejects(restored.handleCallback(callback(attempt)), /Invalid or expired/);
  assert.equal(JSON.parse(readFileSync(join(directory, 'accounts.json'))).attempts.length, 0);
  assert.equal(JSON.parse(readFileSync(join(directory, 'accounts.json'))).hostId, saved.hostId);
});

test('the main backend serves the loopback callback without accepting an alternate host', async t => {
  const { runtime } = fixture(t, async () => { throw new Error('Unexpected token exchange'); });
  const server = createApiServer({ chatgpt: runtime });
  t.after(() => server.close());
  async function callbackResponse(host) {
    const req = Readable.from([]);
    Object.assign(req, { method: 'GET', url: '/auth/callback?state=missing&code=test', headers: { host } });
    return new Promise(resolve => {
      const headers = {};
      const res = { status: 200, setHeader(name, value) { headers[name] = value; }, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, body, headers }); } };
      server.listeners('request')[0](req, res);
    });
  }
  const result = await callbackResponse('127.0.0.1:3001');
  assert.equal(result.status, 400);
  assert.match(result.body, /Invalid or expired/);
  assert.match(result.headers['Content-Type'], /text\/plain/);
  assert.equal(result.headers['Referrer-Policy'], 'no-referrer');
  assert.equal((await callbackResponse('localhost:3001')).status, 400);
  assert.equal((await callbackResponse('evil.example')).status, 403);
});

test('OAuth callback rejects arbitrary destinations and ambiguous parameters without exchanging tokens', async t => {
  let exchanges = 0;
  const { runtime, directory } = fixture(t, async () => { exchanges++; throw new Error('Unexpected exchange'); });
  const started = await runtime.beginSignIn(undefined, redirectUri);
  const saved = JSON.parse(readFileSync(join(directory, 'accounts.json')));
  const attempt = saved.attempts.find(item => item.state === new URL(started.url).searchParams.get('state'));
  for (const url of ['not a url', callback(attempt).replace('127.0.0.1', 'other.example'), callback(attempt).replace('http:', 'https:'), `${callback(attempt)}&state=extra`, `${callback(attempt)}#fragment`, callback(attempt).replace('127.0.0.1', 'name@127.0.0.1')]) {
    await assert.rejects(runtime.handleCallback(url));
  }
  assert.equal(exchanges, 0);
  assert.equal(JSON.parse(readFileSync(join(directory, 'accounts.json'))).attempts.length, 1);
});

test('ID token verification rejects signature, issuer, audience, expiry, and nonce failures', async t => {
  const wrongKeys = await generateKeyPair('RS256');
  for (const bad of ['signature', 'issuer', 'audience', 'expiry', 'nonce']) {
    const { attempt } = createSignInAttempt('host', redirectUri);
    const id_token = await new SignJWT({ nonce: bad === 'nonce' ? 'wrong' : attempt.nonce }).setProtectedHeader({ alg: 'RS256' })
      .setIssuer(bad === 'issuer' ? 'https://other.example' : issuer).setAudience(bad === 'audience' ? 'other-client' : clientId).setSubject('user-1').setExpirationTime(bad === 'expiry' ? 0 : '1h').sign(bad === 'signature' ? wrongKeys.privateKey : keyPair.privateKey);
    const { runtime } = fixture(t, async () => ok({ ...baseTokens, id_token }));
    await assert.rejects(runtime.completeSignIn(callback(attempt), attempt), /verify|different account/);
    assert.deepEqual(runtime.accounts(), []);
  }
});

test('identity-only authorization cannot enable inference', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  const tokens = await tokensFor(attempt, {}, { scope: 'openid email profile' });
  const { runtime } = fixture(t, async () => ok(tokens));
  await assert.rejects(runtime.completeSignIn(callback(attempt), attempt), /plan usage was not granted/);
  assert.deepEqual(runtime.accounts(), []);
});

test('returning authorization reuses its issued client and never exposes the retained ID token', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  let tokens = await tokensFor(attempt);
  const { runtime, directory } = fixture(t, async () => ok(tokens));
  await runtime.completeSignIn(callback(attempt), attempt);
  const saved = JSON.parse(readFileSync(join(directory, 'accounts.json')));
  const returning = createSignInAttempt(saved.hostId, redirectUri, saved.accounts[0]);
  const params = new URL(returning.url).searchParams;
  assert.equal(params.get('client_id'), clientId);
  assert.equal(params.get('agent_name_hint'), null);
  assert.equal(params.get('id_token_hint'), null);
  assert.equal(params.get('login_hint'), 'person@example.com');
  const oldRevision = runtime.accounts()[0].revision;
  tokens = await tokensFor(returning.attempt);
  const url = new URL(callback(returning.attempt)); url.searchParams.delete('client_id');
  await runtime.completeSignIn(url.href, returning.attempt);
  assert.equal(runtime.accounts().length, 1);
  assert.notEqual(runtime.accounts()[0].revision, oldRevision);
  const wrong = createSignInAttempt(saved.hostId, redirectUri, saved.accounts[0]);
  await assert.rejects(runtime.completeSignIn(callback(wrong.attempt, { client_id: 'oaiapp_other' }), wrong.attempt), /expected client/);
});

test('returning sign-in cannot replace credentials with another verified identity', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  let tokens = await tokensFor(attempt);
  const { runtime, directory } = fixture(t, async () => ok(tokens));
  await runtime.completeSignIn(callback(attempt), attempt);
  const saved = JSON.parse(readFileSync(join(directory, 'accounts.json')));
  const returning = createSignInAttempt(saved.hostId, redirectUri, saved.accounts[0]);
  tokens = { ...baseTokens, id_token: await new SignJWT({ nonce: returning.attempt.nonce }).setProtectedHeader({ alg: 'RS256' }).setIssuer(issuer).setAudience(clientId).setSubject('another-user').setExpirationTime('1h').sign(keyPair.privateKey) };
  await assert.rejects(runtime.completeSignIn(callback(returning.attempt), returning.attempt), /different account/);
  assert.equal(await runtime.accessToken(clientId), baseTokens.access_token);
});

test('concurrent refreshes serialize rotating tokens and persist replacements together', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  const tokens = await tokensFor(attempt, {}, { expires_in: 1 });
  let refreshes = 0;
  const { runtime, directory } = fixture(t, async (url, options) => {
    const fields = new URLSearchParams(options.body);
    if (fields.get('grant_type') === 'authorization_code') return ok(tokens);
    refreshes++;
    assert.equal(fields.get('client_id'), clientId);
    assert.equal(fields.get('refresh_token'), baseTokens.refresh_token);
    assert.equal(fields.get('scope'), null);
    return ok({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 3600 });
  });
  await runtime.completeSignIn(callback(attempt), attempt);
  assert.deepEqual(await Promise.all([runtime.accessToken(clientId), runtime.accessToken(clientId)]), ['new-access', 'new-access']);
  assert.equal(refreshes, 1);
  const saved = JSON.parse(readFileSync(join(directory, 'accounts.json'))).accounts[0];
  assert.equal(saved.refresh_token, 'new-refresh');
  assert.equal(saved.access_token, 'new-access');
  assert.ok(saved.scopes.includes('chatgpt.tokens.use.direct'));
});

test('sign-out revokes the renewable session, clears tokens, and retains host and client mapping', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  const tokens = await tokensFor(attempt);
  const { runtime, directory } = fixture(t, async (url, options) => {
    if (url.endsWith('/oauth/token')) return ok(tokens);
    if (url.endsWith('openid-configuration')) return ok({ revocation_endpoint: `${issuer}/revoke` });
    assert.equal(url, `${issuer}/revoke`);
    assert.equal(new URLSearchParams(options.body).get('token'), baseTokens.refresh_token);
    return new Response('', { status: 200 });
  });
  await runtime.completeSignIn(callback(attempt), attempt);
  const oldHost = JSON.parse(readFileSync(join(directory, 'accounts.json'))).hostId;
  assert.equal((await runtime.signOut(clientId)).revoked, true);
  await assert.rejects(runtime.accessToken(clientId), /reconnect/);
  const saved = JSON.parse(readFileSync(join(directory, 'accounts.json')));
  assert.equal(saved.hostId, oldHost);
  assert.equal(saved.accounts[0].client_id, clientId);
  for (const key of ['access_token', 'refresh_token', 'id_token']) assert.equal(saved.accounts[0][key], undefined);
});

test('removing an account revokes its session and persists its removal', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  const tokens = await tokensFor(attempt);
  let revoked = false;
  const { runtime, directory } = fixture(t, async url => {
    if (url.endsWith('/oauth/token')) return ok(tokens);
    if (url.endsWith('openid-configuration')) return ok({ revocation_endpoint: `${issuer}/revoke` });
    revoked = true;
    return new Response('', { status: 200 });
  });
  await runtime.completeSignIn(callback(attempt), attempt);
  await runtime.removeAccount(clientId);
  assert.equal(revoked, true);
  assert.deepEqual(runtime.accounts(), []);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, 'accounts.json'))).accounts, []);
  await assert.rejects(runtime.accessToken(clientId), /saved ChatGPT account/);
});

test('failed remote revocation still signs out locally and reports the limitation', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  const tokens = await tokensFor(attempt);
  const { runtime } = fixture(t, async url => {
    if (url.endsWith('/oauth/token')) return ok(tokens);
    throw new Error('offline');
  });
  await runtime.completeSignIn(callback(attempt), attempt);
  const result = await runtime.signOut(clientId);
  assert.equal(result.revoked, false);
  assert.match(result.message, /not confirmed/);
  assert.equal(runtime.accounts()[0].connected, false);
});

function stream(events, chunkSize = 17, ending = '\n\n') {
  const text = events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}${ending}`).join('');
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let start = 0; start < bytes.length; start += chunkSize) controller.enqueue(bytes.slice(start, start + chunkSize));
    controller.close();
  } }));
}
const complete = (name = 'test', result = { message: 'Hello 🧠' }) => ({ type: 'response.completed', response: { status: 'completed', output: [{ type: 'function_call', namespace: 'feynman', name, arguments: JSON.stringify(result) }] } });

test('stream parsing handles split UTF-8 and CRLF and waits for terminal completion', async () => {
  for (const ending of ['\n\n', '\r\n\r\n']) assert.deepEqual(await readResponseStream(stream([{ type: 'response.created' }, complete()], 1, ending), 'test'), { message: 'Hello 🧠' });
  await assert.rejects(readResponseStream(stream([{ type: 'response.output_item.done', item: complete().response.output[0] }]), 'test'), /before completing/);
});

test('plan streams retain finished function calls when terminal output is empty', async () => {
  const item = { ...complete().response.output[0], id: 'fc_test', status: 'completed' };
  const events = [
    { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', arguments: '' } },
    { type: 'response.function_call_arguments.done', output_index: 0, item_id: item.id, arguments: item.arguments },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { status: 'completed', output: [] } },
  ];
  for (const ending of ['\n\n', '\r\n\r\n']) {
    assert.deepEqual(await readResponseStream(stream(events, 1, ending), 'test'), { message: 'Hello 🧠' });
  }
  // Some API responses also repeat the item in the terminal snapshot.
  assert.deepEqual(await readResponseStream(stream([...events.slice(0, -1), complete()]), 'test'), { message: 'Hello 🧠' });
});

test('finished stream items still require successful completion and one valid tool call', async () => {
  const item = { ...complete().response.output[0], status: 'completed' };
  const finished = { type: 'response.output_item.done', output_index: 0, item };
  const terminal = { type: 'response.completed', response: { status: 'completed', output: [] } };
  await assert.rejects(readResponseStream(stream([finished]), 'test'), /before completing/);
  await assert.rejects(readResponseStream(stream([finished, { type: 'response.incomplete' }]), 'test'), /incomplete/);
  await assert.rejects(readResponseStream(stream([finished, { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }]), 'test'), /plan usage limit/);
  await assert.rejects(readResponseStream(stream([finished, { ...finished, output_index: 1 }, terminal]), 'test'), /structured response/);
  for (const change of [{ name: 'wrong' }, { namespace: 'other' }, { status: 'incomplete' }]) {
    await assert.rejects(readResponseStream(stream([{ ...finished, item: { ...item, ...change } }, terminal]), 'test'), /structured response/);
  }
  await assert.rejects(readResponseStream(stream([{ ...finished, item: { ...item, arguments: '{' } }, terminal]), 'test'), /invalid structured data/);
});

test('streamed usage limits, incomplete responses, and wrong or malformed tool output fail explicitly', async () => {
  await assert.rejects(readResponseStream(stream([{ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }]), 'test'), /plan usage limit/);
  await assert.rejects(readResponseStream(stream([{ type: 'response.incomplete' }]), 'test'), /incomplete/);
  await assert.rejects(readResponseStream(stream([complete('wrong')]), 'test'), /structured response/);
  const malformed = complete(); malformed.response.output[0].arguments = '{';
  await assert.rejects(readResponseStream(stream([malformed]), 'test'), /invalid structured data/);
});

test('ChatGPT requests use plan-compatible Responses fields, namespaces, images, PDFs, and structured results', async () => {
  const runtime = { listModels: async () => [{ slug: 'account-model' }], accessToken: async () => 'oauth-token' };
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'Study this' }, { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' }, { type: 'document', mimeType: 'application/pdf', data: 'cGRm' }] }, { role: 'assistant', content: 'Question' }];
  const query = chatGPTQuery(runtime, clientId, '', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer oauth-token');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'account-model');
    assert.equal(body.store, false); assert.equal(body.stream, true);
    assert.equal(body.instructions, 'system');
    for (const field of ['max_output_tokens', 'temperature', 'previous_response_id', 'conversation', 'background']) assert.equal(body[field], undefined);
    assert.equal(body.tools[0].type, 'namespace');
    assert.equal(body.tools[0].tools[0].name, 'test');
    assert.equal(body.tool_choice, 'required');
    assert.equal(body.input[0].content[1].image_url, 'data:image/png;base64,aGVsbG8=');
    assert.equal(body.input[0].content[2].file_data, 'data:application/pdf;base64,cGRm');
    assert.equal(body.input[1].content, 'Question');
    return stream([complete()]);
  });
  assert.deepEqual(await query('system', messages, { name: 'test', schema: { type: 'object' } }), { message: 'Hello 🧠' });
  assert.equal(responseInput([{ role: 'assistant', content: [{ type: 'text', text: 'Prior answer' }] }])[0].content[0].type, 'output_text');
});

test('unavailable model and account limits never trigger a paid fallback', async () => {
  const runtime = { listModels: async () => [{ slug: 'available' }], accessToken: async () => 'token' };
  let calls = 0;
  const query = chatGPTQuery(runtime, clientId, 'unavailable', async () => { calls++; });
  await assert.rejects(query('', [], { name: 'test' }), /model available/);
  assert.equal(calls, 0);
  const limited = chatGPTQuery(runtime, clientId, '', async () => { calls++; return new Response(JSON.stringify({ error: { code: 'subscription_sharing_usage_limit_exceeded' } }), { status: 429 }); });
  await assert.rejects(limited('', [], { name: 'test' }), /plan usage limit/);
  assert.equal(calls, 1);
});

test('account catalog preserves visible model ordering and is cached separately', async t => {
  const { attempt } = createSignInAttempt('host', redirectUri);
  const tokens = await tokensFor(attempt);
  let calls = 0;
  const { runtime } = fixture(t, async (url, options) => {
    if (url.endsWith('/oauth/token')) return ok(tokens);
    assert.equal(url, 'https://api.openai.com/v1/models');
    assert.equal(options.headers.Authorization, 'Bearer access-secret');
    calls++;
    return ok({ models: [{ slug: 'first', display_name: 'First', visibility: 'list' }, { slug: 'hidden', visibility: 'hidden' }, { slug: 'second', display_name: 'Second', visibility: 'list' }] });
  });
  await runtime.completeSignIn(callback(attempt), attempt);
  assert.deepEqual(await runtime.listModels(clientId), [{ slug: 'first', name: 'First' }, { slug: 'second', name: 'Second' }]);
  await runtime.listModels(clientId);
  assert.equal(calls, 1);
});

async function invoke(server, { method = 'GET', url = '/api/health', body, headers = {} } = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method, url, headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json', ...headers } });
  return new Promise(resolve => {
    const res = { status: 200, setHeader() {}, writeHead(status) { this.status = status; }, end(value) { resolve({ status: this.status, data: JSON.parse(value) }); } };
    server.listeners('request')[0](req, res);
  });
}

test('API supports ChatGPT without an Anthropic key and rejects remote hosts and unsafe account mutations', async t => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousKey; });
  let signIns = 0;
  const chatgpt = { accounts: () => [{ id: clientId, connected: true, email: 'person@example.com' }], close() {}, beginSignIn: async () => { signIns++; return { url: 'https://auth.openai.com/' }; } };
  const server = createApiServer({ chatgpt, query: async () => ({ items: ['Explains conservation of energy.'] }) });
  t.after(() => server.close());
  const headers = { 'x-feynman-provider': 'chatgpt', 'x-feynman-account': clientId };
  const health = await invoke(server, { headers });
  assert.equal(health.data.configured, true); assert.equal(health.data.anthropicConfigured, false);
  assert.equal((await invoke(server)).data.configured, false);
  const rubric = await invoke(server, { method: 'POST', url: '/api/developer/rubric', headers, body: { topic: 'Energy', level: 'understand', learningType: 'theoretical' } });
  assert.equal(rubric.status, 200);
  for (const unsafe of [{ host: 'evil.example' }, { origin: 'https://evil.example' }, { origin: undefined }, { 'content-type': 'text/plain' }]) {
    assert.equal((await invoke(server, { method: 'POST', url: '/api/ai/sign-in', body: {}, headers: unsafe })).status, 403);
  }
  assert.equal(signIns, 0);
  assert.equal((await invoke(server, { method: 'POST', url: '/api/ai/sign-in', body: {} })).status, 200);
  assert.equal(signIns, 1);
  const disconnected = await invoke(server, { method: 'POST', url: '/api/developer/rubric', headers: { ...headers, 'x-feynman-account': 'missing' }, body: { topic: 'Energy', level: 'understand' } });
  assert.equal(disconnected.status, 503);
  assert.match(disconnected.data.error, /Continue with ChatGPT/);
});
