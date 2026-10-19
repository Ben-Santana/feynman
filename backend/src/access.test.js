import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';
import { AccountError, createAccountService, validAccountEmail } from './accounts.js';
import { testAccountService, testAuthorization } from './accessTestHelper.js';

function invoke(server, { method = 'GET', url = '/api/account', body, authorization = testAuthorization, origin = 'http://localhost:5173', headers = {} } = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method, url, headers: { host: 'localhost:5173', origin, authorization, ...headers } });
  return new Promise(resolve => server.emit('request', req, {
    setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); },
  }));
}
const wpi = { id: '11111111-1111-4111-8111-111111111111', email: 'Learner@wpi.edu', email_confirmed_at: '2026-10-12T00:00:00Z', app_metadata: { provider: 'azure' }, identities: [{ provider: 'azure' }] };
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-key', SUPABASE_SECRET_KEY: 'private-key' };
function clients({ user = wpi, authError = null, role = 'student', roleError = null, rpcError = null, allowed = true, approved = true, eligibilityError = null } = {}) {
  const calls = [];
  return { calls, factory(url, key, options) {
    calls.push({ url, key, options });
    return {
      auth: { async getUser(token) { calls.push({ token }); return { data: { user }, error: authError }; } },
      from(table) { return { select() { return this; }, eq() { return this; }, async single() { return table === 'profiles' ? { data: { id: user?.id, email: user?.email, display_name: 'Learner', approved }, error: null } : { data: { role }, error: roleError }; } }; },
      async rpc(name, args) { calls.push({ name, args }); return name === 'account_signed_in' ? { data: allowed, error: eligibilityError } : { data: { users: [], role: args?.new_role }, error: rpcError }; },
    };
  } };
}

test('account email accepts any valid address without confirmation; database controls sign-in eligibility', () => {
  assert.equal(validAccountEmail(wpi), true);
  assert.equal(validAccountEmail({ ...wpi, email: 'learner@example.com', email_confirmed_at: null }), true);
  for (const email of ['user@other.edu', 'user@alum.wpi.edu']) assert.equal(validAccountEmail({ ...wpi, email }), true);
  for (const user of [null, { ...wpi, email: 'invalid' }, { ...wpi, email: 'user@@example.com' }]) assert.equal(validAccountEmail(user), false);
});
test('account configuration fails closed and never accepts old access cookies', async t => {
  const server = createApiServer({ hosted: true, env: { VERCEL_URL: 'preview.vercel.app' } }); t.after(() => server.close());
  const result = await invoke(server, { origin: 'https://preview.vercel.app', headers: { cookie: 'feynman_access=old-session' } });
  assert.equal(result.status, 503);
  assert.match(result.data.error, /not configured/);
});
test('auth validates the bearer token with Supabase and reads a protected database role', async () => {
  const fixture = clients({ user: { ...wpi, email: 'learner@example.com', email_confirmed_at: null, user_metadata: { role: 'admin' } } });
  const service = createAccountService(env, fixture.factory);
  const account = await service.authenticate({ headers: { authorization: 'Bearer opaque-token' } });
  assert.equal(account.role, 'student');
  assert.equal(fixture.calls[2].name, 'account_signed_in');
  assert.equal(fixture.calls[0].key, 'public-key');
  assert.equal(fixture.calls[0].options.global.headers.Authorization, 'Bearer opaque-token');
  assert.equal(fixture.calls[1].token, 'opaque-token');
});
test('missing, expired, invalid-email, and missing-role logins are rejected', async () => {
  for (const [fixture, headers, status] of [
    [clients(), {}, 401], [clients(), { authorization: 'Basic test' }, 401],
    [clients({ authError: new Error('expired') }), { authorization: 'Bearer expired' }, 401],
    [clients({ user: { ...wpi, email: 'invalid' } }), { authorization: 'Bearer test' }, 403],
    [clients({ allowed: false }), { authorization: 'Bearer password-session-after-cutover' }, 403],
    [clients({ eligibilityError: new Error('missing migration') }), { authorization: 'Bearer test' }, 503],
    [clients({ roleError: new Error('missing') }), { authorization: 'Bearer test' }, 503],
  ]) await assert.rejects(createAccountService(env, fixture.factory).authenticate({ headers }), error => error.status === status);
});
test('direct API requests require login and reject untrusted origins', async t => {
  const server = createApiServer({ accountService: testAccountService() }); t.after(() => server.close());
  assert.equal((await invoke(server)).data.role, 'admin');
  for (const url of ['/api/health', '/api/ai/providers', '/api/chat', '/api/rubric', '/api/account']) assert.equal((await invoke(server, { url, authorization: '' })).status, 401);
  assert.equal((await invoke(server, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await invoke(server, { url: '/api/access', method: 'POST', authorization: '', body: { code: '6767' } })).status, 401);
});
test('student and instructor cannot administer users, trace prompts, or use local ChatGPT', async t => {
  for (const role of ['student', 'instructor']) {
    const server = createApiServer({ accountService: testAccountService(role) }); t.after(() => server.close());
    for (const url of ['/api/admin/users', '/api/developer/prompts', '/api/developer/rubric', '/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account']) assert.equal((await invoke(server, { url })).status, 403);
    assert.equal((await invoke(server, { url: '/api/chat', method: 'POST', headers: { 'x-feynman-trace': '1' } })).status, 403);
    assert.equal((await invoke(server, { url: '/api/health', headers: { 'x-feynman-provider': 'chatgpt' } })).status, 403);
    const catalog = await invoke(server, { url: '/api/ai/providers' });
    assert.equal(catalog.status, 200); assert.ok(catalog.data.providers.every(item => item.id !== 'chatgpt'));
    const health = await invoke(server, { url: '/api/health' });
    assert.deepEqual(health.data.accounts, []); assert.equal(health.data.pendingRegistration, false);
  }
});
test('admin endpoints route validated role edits and pagination to the account service', async t => {
  const accountService = testAccountService();
  accountService.listUsers = async (_account, params) => ({ users: [], page: Number(params.get('page')) });
  accountService.changeRole = async (_account, id, role) => ({ id, role });
  const server = createApiServer({ accountService }); t.after(() => server.close());
  assert.equal((await invoke(server, { url: '/api/admin/users?page=2&search=learner' })).data.page, 2);
  assert.equal((await invoke(server, { url: `/api/admin/users/${wpi.id}/role`, method: 'PATCH', body: { role: 'instructor' } })).data.role, 'instructor');
});
test('admin RPCs use backend-only credentials and reject bad inputs and final-admin demotion', async () => {
  const fixture = clients(); const service = createAccountService(env, fixture.factory);
  const admin = { id: wpi.id, role: 'admin' };
  await service.changeRole(admin, wpi.id, 'instructor');
  assert.equal(fixture.calls[0].key, 'private-key');
  assert.equal(fixture.calls[1].args.actor_id, admin.id);
  await assert.rejects(service.changeRole(admin, 'invalid', 'student'), error => error.status === 400);
  await assert.rejects(service.changeRole(admin, wpi.id, 'superuser'), error => error.status === 400);
  await assert.rejects(service.changeRole({ ...admin, role: 'student' }, wpi.id, 'admin'), error => error.status === 403);
  await assert.rejects(service.listUsers(admin, new URLSearchParams('page=-1')), error => error.status === 400);
  const finalAdmin = clients({ rpcError: { code: '23514' } });
  await assert.rejects(createAccountService(env, finalAdmin.factory).changeRole(admin, wpi.id, 'student'), error => error instanceof AccountError && error.status === 409);
});

test('pending accounts can check status but cannot use any application API', async t => {
  const fixture = clients({ approved: false });
  const accountService = createAccountService(env, fixture.factory);
  const server = createApiServer({ accountService }); t.after(() => server.close());
  const status = await invoke(server);
  assert.equal(status.status, 200);
  assert.equal(status.data.approved, false);
  for (const url of ['/api/health', '/api/ai/providers', '/api/admin/users', '/api/developer/prompts']) {
    assert.equal((await invoke(server, { url })).status, 403);
  }
  for (const url of ['/api/chat', '/api/rubric', `/api/admin/users/${wpi.id}/approval`]) {
    assert.equal((await invoke(server, { url, method: 'PATCH', body: {} })).status, 403);
  }
});
test('account approval requires an admin and uses backend-only RPC credentials', async () => {
  const fixture = clients(); const service = createAccountService(env, fixture.factory);
  await service.approveAccount({ id: wpi.id, role: 'admin' }, wpi.id);
  assert.equal(fixture.calls[0].key, 'private-key');
  assert.deepEqual(fixture.calls[1], { name: 'admin_approve_account', args: { actor_id: wpi.id, target_id: wpi.id } });
  await assert.rejects(service.approveAccount({ role: 'student' }, wpi.id), error => error.status === 403);
  await assert.rejects(service.approveAccount({ role: 'admin' }, 'invalid'), error => error.status === 400);
});
test('admin approval endpoint routes to the account service', async t => {
  const accountService = testAccountService();
  accountService.approveAccount = async (_account, id) => ({ id, approved: true });
  const server = createApiServer({ accountService }); t.after(() => server.close());
  const response = await invoke(server, { url: `/api/admin/users/${wpi.id}/approval`, method: 'PATCH', body: {} });
  assert.equal(response.status, 200);
  assert.deepEqual(response.data, { id: wpi.id, approved: true });
});

test('missing approval migration reports the required setup instead of a sign-in failure', async () => {
  const fixture = clients({ eligibilityError: { code: 'PGRST202' } });
  const service = createAccountService(env, fixture.factory);
  await assert.rejects(service.authenticate({ headers: { authorization: 'Bearer test' } }), error => {
    assert.equal(error.status, 503);
    assert.match(error.message, /202610160003_account_approval.sql/);
    return true;
  });
});
