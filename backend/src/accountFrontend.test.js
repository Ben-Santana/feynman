import test from 'node:test';
import assert from 'node:assert/strict';
import { activateAccount, accountSignal, savePendingAccountRole, completeAccountCallback, signInWithWpi, signInWithEmail, signUpWithEmail, requestPasswordReset, updateAccountPassword, saveAccountDisplayName, loadAccountAuthMode, supabase } from '../../frontend/src/accounts.ts';
import { createAppearanceStore } from '../../frontend/src/cloudAppearance.ts';
import { defaultAppearance } from '../../frontend/src/characterAppearance.ts';
import { aiPreferences, saveAIPreferences } from '../../frontend/src/aiPreferences.ts';

test('WPI sign-in requests Azure email with a separate account callback', async () => {
  let request;
  const client = { auth: { async signInWithOAuth(value) { request = value; return { error: null }; } } };
  await signInWithWpi(client, 'https://learning.example');
  assert.deepEqual(request, { provider: 'azure', options: { scopes: 'email', redirectTo: 'https://learning.example/account/callback' } });
});
test('account callback exchanges its PKCE code and removes callback parameters from history', async () => {
  let received, replaced;
  const client = { auth: { async exchangeCodeForSession(code) { received = code; return { error: null }; } } };
  await completeAccountCallback(new URL('https://learning.example/account/callback?code=oauth-code'), client, path => { replaced = path; });
  assert.equal(received, 'oauth-code'); assert.equal(replaced, '/dashboard');
});
test('failed, missing, ambiguous, and expired callbacks do not navigate into the app', async () => {
  let exchanges = 0, redirects = 0;
  const client = { auth: { async exchangeCodeForSession() { exchanges++; return { error: new Error('expired') }; } } };
  for (const query of ['?error=access_denied', '', '?code=', '?code=a&code=b', '?code=expired']) {
    await assert.rejects(completeAccountCallback(new URL(`https://learning.example/account/callback${query}`), client, () => { redirects++; }));
  }
  assert.equal(exchanges, 1); assert.equal(redirects, 0);
});
test('missing frontend account configuration fails closed', () => {
  assert.throws(() => supabase(), /not configured/);
});
test('profile saves only the trimmed name on the signed-in profile and returns the confirmed server values', async t => {
  t.after(() => activateAccount(null));
  const account = { id: 'learner', display_name: 'Old name', role: 'student', email: 'learner@wpi.edu' };
  activateAccount(account);
  const calls = [];
  const query = {
    update(value) { calls.push(['update', value]); return this; },
    eq(key, value) { calls.push(['eq', key, value]); return this; },
    select(value) { calls.push(['select', value]); return this; },
    abortSignal(signal) { assert.equal(signal, accountSignal()); return this; },
    async single() { return { data: { display_name: 'New name', updated_at: 'server-timestamp' }, error: null }; },
  };
  const client = { from(table) { assert.equal(table, 'profiles'); return query; } };
  assert.deepEqual(await saveAccountDisplayName(account, '  New name  ', client), { ...account, display_name: 'New name', updated_at: 'server-timestamp' });
  assert.deepEqual(calls, [['update', { display_name: 'New name' }], ['eq', 'id', 'learner'], ['select', 'display_name, updated_at']]);
  assert.equal(account.display_name, 'Old name');
  for (const name of ['   ', 'a'.repeat(101)]) await assert.rejects(saveAccountDisplayName(account, name, client), /between 1 and 100/);
  for (const result of [{ data: null, error: null }, { data: null, error: new Error('offline') }]) {
    query.single = async () => result;
    await assert.rejects(saveAccountDisplayName(account, 'New name', client), /Could not save/);
  }
  query.single = async () => { activateAccount(null); return { data: { display_name: 'New name' } }; };
  await assert.rejects(saveAccountDisplayName(account, 'New name', client), { name: 'AbortError' });
});
test('account lifecycle aborts requests on logout and account switching, without aborting same-user role refreshes', t => {
  t.after(() => activateAccount(null));
  activateAccount({ id: 'first', role: 'student' }); const first = accountSignal();
  activateAccount({ id: 'first', role: 'admin' }); assert.equal(first.aborted, false);
  activateAccount({ id: 'second', role: 'student' }); assert.equal(first.aborted, true);
  const second = accountSignal(); activateAccount(null); assert.equal(second.aborted, true);
});
test('AI preferences start fresh and do not leak provider connections between accounts', t => {
  const originalStorage = globalThis.localStorage, originalWindow = globalThis.window, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = { dispatchEvent() {} };
  t.after(() => { activateAccount(null); globalThis.localStorage = originalStorage; globalThis.window = originalWindow; });
  values.set('feynman-ai-preferences', JSON.stringify({ provider: 'chatgpt', accountId: 'anonymous-account' }));
  activateAccount({ id: 'first', role: 'admin' }); assert.equal(aiPreferences().provider, 'anthropic'); assert.equal(aiPreferences().accountId, '');
  saveAIPreferences({ provider: 'chatgpt', accountId: 'first-connection', model: 'model' });
  activateAccount({ id: 'second', role: 'student' }); assert.equal(aiPreferences().accountId, '');
  activateAccount({ id: 'first', role: 'admin' }); assert.equal(aiPreferences().accountId, 'first-connection');
});
test('cloud appearance restores across devices, preserves failed drafts, and isolates account recovery', async t => {
  const original = globalThis.localStorage, values = new Map(), rows = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  t.after(() => { globalThis.localStorage = original; });
  let id = 'first', fail = false;
  const client = { from() {
    return { selected: '', write: null, select() { return this; }, eq(_key, value) { this.selected = value; return this; }, upsert(value) { this.write = value; return this; },
      abortSignal(signal) {
        if (!this.write) return this;
        if (signal.aborted || fail) return Promise.resolve({ error: new Error('offline') });
        rows.set(this.write.user_id, this.write.appearance); return Promise.resolve({ error: null });
      },
      async maybeSingle() { return { data: rows.has(this.selected) ? { appearance: rows.get(this.selected) } : null, error: null }; },
    };
  } };
  const store = () => createAppearanceStore({ client: () => client, getAccount: () => ({ id }), getSignal: () => new AbortController().signal });
  values.set('feynman.character.v1', JSON.stringify({ version: 1, appearance: { name: 'Anonymous' } }));
  assert.deepEqual((await store().loadCloudAppearance()).appearance, defaultAppearance);
  await store().saveCloudAppearance({ ...defaultAppearance, name: 'Mochi', color: 'mint' });
  assert.equal((await store().loadCloudAppearance()).appearance.name, 'Mochi');
  fail = true; await assert.rejects(store().saveCloudAppearance({ ...defaultAppearance, name: 'Unsaved' }));
  assert.equal((await store().loadCloudAppearance()).appearance.name, 'Unsaved');
  assert.equal((await store().loadCloudAppearance()).pending, true);
  id = 'second'; assert.deepEqual((await store().loadCloudAppearance()).appearance, defaultAppearance);
  id = 'first'; fail = false;
  await store().saveCloudAppearance((await store().loadCloudAppearance()).appearance);
  assert.equal((await store().loadCloudAppearance()).pending, false);
  assert.ok(values.has('feynman.character.v1'));
});

test('email signup accepts any email without an invite, confirmation redirect, or verification step', async () => {
  let request, calls = 0;
  const client = { auth: { async signUp(value) { calls++; request = value; return { data: { session: { access_token: 'session' } }, error: null }; } } };
  for (const email of [' Learner@Example.com ', 'user@wpi.edu', 'user@alum.wpi.edu']) {
    await signUpWithEmail(email, 'separate-app-password', 'student', client);
    assert.deepEqual(request, { email: email.trim().toLowerCase(), password: 'separate-app-password', options: { data: { role: 'student' } } });
  }
  for (const email of ['', 'user', 'user@@example.com', 'user@ example.com']) await assert.rejects(signUpWithEmail(email, 'separate-app-password', 'student', client));
  await assert.rejects(signUpWithEmail('learner@example.com', 'short', 'student', client));
  assert.equal(calls, 3);
  await signUpWithEmail('instructor@example.com', 'separate-app-password', 'instructor', client);
  assert.equal(request.options.data.role, 'instructor');
  await assert.rejects(signUpWithEmail('learner@example.com', 'separate-app-password', 'admin', client), /Choose Instructor or Student/);
  assert.equal(calls, 4);
  client.auth.signUp = async () => ({ error: new Error('Signup unavailable') });
  await assert.rejects(signUpWithEmail('learner@example.com', 'separate-app-password', 'student', client), /Signup unavailable/);
});
test('signup signs in if Supabase creates the account without returning a session', async () => {
  let login;
  const client = { auth: {
    async signUp() { return { data: { session: null }, error: null }; },
    async signInWithPassword(value) { login = value; return { error: null }; },
  } };
  await signUpWithEmail(' Learner@Example.com ', 'separate-app-password', 'student', client);
  assert.deepEqual(login, { email: 'learner@example.com', password: 'separate-app-password' });
});
test('password login and reset use Supabase, propagate errors, and do not change the password text', async () => {
  let login, reset, update;
  const client = { auth: {
    async signInWithPassword(value) { login = value; return { error: null }; },
    async resetPasswordForEmail(email, options) { reset = { email, options }; return { error: null }; },
    async updateUser(value) { update = value; return { error: null }; },
  } };
  await signInWithEmail(' Learner@Example.com ', ' password with spaces ', client);
  assert.deepEqual(login, { email: 'learner@example.com', password: ' password with spaces ' });
  await requestPasswordReset('Learner@Example.com', client, 'https://learning.example');
  assert.deepEqual(reset, { email: 'learner@example.com', options: { redirectTo: 'https://learning.example/account/reset-password' } });
  await updateAccountPassword('separate-app-password', client);
  assert.deepEqual(update, { password: 'separate-app-password' });
  await assert.rejects(updateAccountPassword('short', client));
  client.auth.signInWithPassword = async () => ({ error: new Error('Invalid credentials') });
  await assert.rejects(signInWithEmail('learner@wpi.edu', 'password', client), /Invalid credentials/);
});
test('login mode comes from the database and fails closed for missing or unknown settings', async () => {
  for (const mode of ['email', 'wpi']) assert.equal(await loadAccountAuthMode({ rpc: async () => ({ data: mode, error: null }) }), mode);
  for (const result of [{ data: null }, { data: 'anything' }, { data: 'email', error: new Error('offline') }]) await assert.rejects(loadAccountAuthMode({ rpc: async () => result }));
});
test('recovery callback exchanges its code and stays on the password update page', async () => {
  let replaced;
  const client = { auth: { async exchangeCodeForSession() { return { error: null }; } } };
  await completeAccountCallback(new URL('https://learning.example/account/reset-password?code=recovery-code'), client, path => { replaced = path; });
  assert.equal(replaced, '/account/reset-password');
});

test('pending account role saves only public roles and reports failed saves', async () => {
  const calls = [];
  const client = { async rpc(name, args) { calls.push({ name, args }); return { data: args.new_role, error: null }; } };
  for (const role of ['instructor', 'student']) assert.equal(await savePendingAccountRole(role, client), role);
  assert.deepEqual(calls, ['instructor', 'student'].map(role => ({ name: 'set_pending_account_role', args: { new_role: role } })));
  await assert.rejects(savePendingAccountRole('admin', client), /Choose Instructor or Student/);
  assert.equal(calls.length, 2);
  client.rpc = async () => ({ error: { code: '42501' } });
  await assert.rejects(savePendingAccountRole('student', client), /account status changed/);
  client.rpc = async () => ({ error: { code: 'PGRST202' } });
  await assert.rejects(savePendingAccountRole('student', client), /Account setup is incomplete/);
  client.rpc = async () => ({ error: { code: 'unknown' } });
  await assert.rejects(savePendingAccountRole('student', client), /Could not update/);
});
