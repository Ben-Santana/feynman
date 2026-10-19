import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createClient } from '@supabase/supabase-js';
import { createLearningStore } from '../../frontend/src/learningStore.ts';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const record = (text = 'Explain energy') => ({ id: sessionId, title: 'Energy', updatedAt: Date.now(), started: true, activeId: 'concept', files: [], concepts: [{ id: 'concept', messages: [{ role: 'user', content: text }], draft: '', assessments: { remember: { complete: true } }, rubric: { remember: 'Explain energy' }, passed: 1 }] });
function fixture(t) {
  const oldIdb = globalThis.indexedDB, oldReader = globalThis.FileReader;
  globalThis.indexedDB = new IDBFactory();
  globalThis.FileReader = class {
    readAsDataURL(blob) { void blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload(); }); }
  };
  t.after(() => { globalThis.indexedDB = oldIdb; globalThis.FileReader = oldReader; });
  let account = { id: first }, lifecycle = new AbortController();
  const state = { rows: new Map(), files: new Map(), writes: [], fail: false, beforeWrite: null };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const client = createClient('https://testing.supabase.co', 'public-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)), method = init.method || 'GET', userId = account.id;
    if (url.pathname === '/rest/v1/learning_sessions') {
      const owner = url.searchParams.get('owner_id')?.slice(3), id = url.searchParams.get('id')?.slice(3);
      const rows = [...state.rows.values()].filter(row => row.owner_id === owner && (!id || row.id === id));
      return json(rows);
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const body = JSON.parse(init.body), key = `${userId}:${body.session_id}`;
      if (state.beforeWrite) { const wait = state.beforeWrite; state.beforeWrite = null; await wait(); }
      if (state.fail) return json({ code: '503', message: 'Disconnected' }, 503);
      const existing = state.rows.get(key);
      if ((existing?.revision || 0) !== body.expected_revision) return json({ code: '40001', message: 'Conflict' }, 409);
      if (url.pathname.endsWith('delete_learning_session')) { state.rows.delete(key); return json(null); }
      const row = { owner_id: userId, id: body.session_id, title: body.session_title, document: body.session_document, revision: body.expected_revision + 1, updated_at: new Date().toISOString() };
      state.rows.set(key, row); state.writes.push(row);
      return json(new Headers(init.headers).get('Accept')?.includes('object') ? row : [row]);
    }
    const prefix = '/storage/v1/object/';
    if (url.pathname.startsWith(prefix)) {
      const path = decodeURIComponent(url.pathname.slice(prefix.length).replace(/^authenticated\//, ''));
      if (method === 'POST') {
        if (state.files.has(path)) return json({ statusCode: '409', error: 'Duplicate', message: 'Already exists' }, 409);
        const form = init.body, blob = form instanceof FormData ? form.get('') : form;
        state.files.set(path, blob);
        return json({ Key: path });
      }
      return state.files.has(path) ? new Response(state.files.get(path)) : json({ message: 'Missing' }, 404);
    }
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  } } });
  const store = () => createLearningStore({ client: () => client, getAccount: () => account, getSignal: () => lifecycle.signal });
  return { state, store, switchAccount(id) { lifecycle.abort(); lifecycle = new AbortController(); account = { id }; } };
}

test('cloud sessions round-trip transcripts, drafts, rubrics, and progress across devices', async t => {
  const { store, state } = fixture(t), writer = store();
  assert.deepEqual(await writer.loadSessions(), []);
  const saved = record(); writer.queueSessionSave(saved); await writer.flushSessionSaves();
  const loaded = await store().loadSessions();
  assert.deepEqual(loaded[0].concepts, saved.concepts);
  assert.equal(state.writes.length, 1); assert.equal(state.writes[0].revision, 1);
  assert.equal(writer.getSaveStatus().state, 'saved');
});
test('rapid draft updates coalesce and updates arriving during a save receive the new revision', async t => {
  const { store, state } = fixture(t), writer = store(); await writer.loadSessions();
  writer.queueSessionSave(record('one')); writer.queueSessionSave(record('two')); writer.queueSessionSave(record('three'));
  await writer.flushSessionSaves(); assert.equal(state.writes.length, 1);
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  state.beforeWrite = async () => { entered(); await waiting; };
  writer.queueSessionSave(record('four'));
  const saving = writer.flushSessionSaves(); await started;
  writer.queueSessionSave(record('five')); release(); await saving; await writer.flushSessionSaves();
  assert.equal(state.writes.at(-1).document.session.concepts[0].messages[0].content, 'five');
  assert.equal(state.writes.at(-1).revision, 3);
});
test('interrupted saves recover per account and retry without losing the draft', async t => {
  const f = fixture(t), writer = f.store(); await writer.loadSessions();
  f.state.fail = true; writer.queueSessionSave(record('unsaved answer'));
  await assert.rejects(writer.flushSessionSaves()); assert.equal(writer.getSaveStatus().state, 'error');
  const recovered = f.store(); assert.equal((await recovered.loadSessions())[0].concepts[0].messages[0].content, 'unsaved answer');
  f.switchAccount(second); assert.deepEqual(await f.store().loadSessions(), []);
  f.switchAccount(first); f.state.fail = false;
  const restored = f.store(); await restored.loadSessions(); await restored.flushSessionSaves();
  assert.equal(f.state.writes[0].document.session.concepts[0].messages[0].content, 'unsaved answer');
});
test('cross-device conflicts preserve local work and can save a copy or reload the server', async t => {
  const f = fixture(t), seed = f.store(); await seed.loadSessions(); seed.queueSessionSave(record('initial')); await seed.flushSessionSaves();
  const left = f.store(), right = f.store(); await left.loadSessions(); await right.loadSessions();
  left.queueSessionSave(record('server answer')); await left.flushSessionSaves();
  right.queueSessionSave(record('local answer')); await right.flushSessionSaves();
  assert.equal(right.getSaveStatus().state, 'conflict');
  const copy = await right.resolveSessionConflict(sessionId, true); await right.flushSessionSaves();
  assert.notEqual(copy.id, sessionId); assert.equal(f.state.rows.size, 2);
  assert.equal(f.state.rows.get(`${first}:${sessionId}`).document.session.concepts[0].messages[0].content, 'server answer');
  const stale = f.store(); await stale.loadSessions();
  left.queueSessionSave(record('new server answer')); await left.flushSessionSaves();
  stale.queueSessionSave(record('discard local')); await stale.flushSessionSaves();
  const latest = await stale.resolveSessionConflict(sessionId, false);
  assert.equal(latest.concepts[0].messages[0].content, 'new server answer');
});
test('files and whiteboards persist as private references and hydrate into the existing runtime format', async t => {
  const f = fixture(t), writer = f.store(); await writer.loadSessions();
  const saved = record(); saved.files = [new File(['notes'], 'study.txt', { type: 'text/plain', lastModified: 123 })];
  saved.concepts[0].messages[0].boardImage = 'data:image/png;base64,aW1hZ2U=';
  writer.queueSessionSave(saved); await writer.flushSessionSaves();
  const wire = f.state.writes[0].document.session;
  assert.equal(wire.files[0].name, 'study.txt'); assert.ok(wire.files[0].path.startsWith(`${first}/${sessionId}/`));
  assert.equal(wire.concepts[0].messages[0].boardImage, undefined);
  const loaded = (await f.store().loadSessions())[0];
  assert.equal(await loaded.files[0].text(), 'notes'); assert.equal(loaded.files[0].name, 'study.txt');
  assert.equal(loaded.concepts[0].messages[0].boardImage, saved.concepts[0].messages[0].boardImage);
  writer.queueSessionSave(saved); await writer.flushSessionSaves(); assert.equal(f.state.files.size, 2);
});
test('account changes abort in-flight work and playground data remains isolated', async t => {
  const f = fixture(t), writer = f.store(); await writer.loadSessions();
  await writer.savePlayground([{ private: true }]);
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  f.state.beforeWrite = async () => { entered(); await waiting; };
  writer.queueSessionSave(record('private answer')); const saving = writer.flushSessionSaves(); await started;
  f.switchAccount(second); release(); await assert.rejects(saving);
  assert.deepEqual(await writer.loadSessions(), []); assert.deepEqual(await writer.loadPlayground(), []);
  assert.ok(!f.state.rows.has(`${second}:${sessionId}`));
});
test('session deletion checks revisions and removes account recovery', async t => {
  const f = fixture(t), writer = f.store(); await writer.loadSessions();
  writer.queueSessionSave(record()); await writer.flushSessionSaves();
  await writer.deleteSession(record());
  assert.deepEqual(await f.store().loadSessions(), []);
});

test('assigned sessions recover and resolve conflicts without creating a second assignment', async t => {
  const f = fixture(t), writer = f.store(); await writer.loadSessions();
  const assignment = { courseId: 'course', courseName: 'Physics', moduleId: 'module' };
  const assigned = { ...record(), assignment };
  writer.queueSessionSave(assigned); await writer.flushSessionSaves();
  const left = f.store(), right = f.store(); await left.loadSessions();
  assert.deepEqual((await right.loadSessions())[0].assignment, assignment);
  left.queueSessionSave({ ...record('server'), assignment }); await left.flushSessionSaves();
  right.queueSessionSave({ ...record('local'), assignment }); await right.flushSessionSaves();
  assert.equal(right.getSaveStatus().state,'conflict');
  await assert.rejects(right.resolveSessionConflict(sessionId,true),/cannot be copied/);
  await assert.rejects(right.deleteSession(assigned),/cannot be deleted/);
  assert.equal(f.state.rows.size,1);
  const reloaded = await right.resolveSessionConflict(sessionId,false);
  assert.equal(reloaded.id,sessionId);
  assert.deepEqual(reloaded.assignment,assignment);
  assert.equal(reloaded.concepts[0].messages[0].content,'server');
  f.state.fail = true;
  right.queueSessionSave({ ...record('offline'), assignment }); await assert.rejects(right.flushSessionSaves());
  const recovered = f.store(); const saved = (await recovered.loadSessions())[0];
  assert.equal(saved.concepts[0].messages[0].content,'offline');
  assert.deepEqual(saved.assignment,assignment);
  f.state.fail = false; await recovered.flushSessionSaves();
  assert.equal(f.state.rows.size,1);
});
test('module drafts and source files use separate account-scoped recovery without creating learning sessions', async t => {
  const f = fixture(t), writer = f.store(); await writer.loadSessions();
  const draft = { record: { ...record(), started: false, files: [new File(['notes'],'source.txt',{type:'text/plain',lastModified:42})] }, revision: 3 };
  await writer.saveModuleRecovery('module',draft);
  assert.equal((await f.store().loadModuleRecovery('module')).revision,3);
  assert.equal(f.state.rows.size,0);
  const document = await writer.encodeSession(draft.record);
  assert.ok(document.session.files[0].path.startsWith(`${first}/${sessionId}/`));
  const loaded = await writer.decodeSession({owner_id:first,id:sessionId,title:draft.record.title,document,revision:3,updated_at:new Date().toISOString()});
  assert.equal(await loaded.files[0].text(),'notes');
  assert.equal(f.state.rows.size,0);
  f.switchAccount(second);
  assert.equal(await writer.loadModuleRecovery('module'),undefined);
  f.switchAccount(first);
  await writer.saveModuleRecovery('module',null);
  assert.equal(await writer.loadModuleRecovery('module'),null);
});
