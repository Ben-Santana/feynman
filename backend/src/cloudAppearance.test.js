import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppearanceStore } from '../../frontend/src/cloudAppearance.ts';
import { defaultAppearance } from '../../frontend/src/characterAppearance.ts';

function fixture(t) {
  const originalStorage = globalThis.localStorage, recovery = new Map();
  globalThis.localStorage = {
    getItem: key => recovery.get(key) ?? null,
    setItem: (key, value) => recovery.set(key, value),
    removeItem: key => recovery.delete(key),
  };
  t.after(() => { globalThis.localStorage = originalStorage; });
  let id = 'first', lifecycle = new AbortController();
  const state = { writes: [], rows: new Map(), fail: false, beforeWrite: null };
  const client = { from(table) {
    assert.equal(table, 'user_customizations');
    return {
      select() { return this; },
      eq(_key, value) { this.selected = value; return this; },
      async maybeSingle() { return { data: { appearance: state.rows.get(this.selected) } }; },
      upsert(row) { this.row = row; return this; },
      abortSignal(signal) {
        if (!this.row) return this;
        const row = this.row;
        state.writes.push(row);
        return (async () => {
          if (state.beforeWrite) { const wait = state.beforeWrite; state.beforeWrite = null; await wait(); }
          signal.throwIfAborted();
          if (state.fail) return { error: new Error('offline') };
          state.rows.set(row.user_id, row.appearance);
          return { error: null };
        })();
      },
    };
  } };
  const makeStore = () => createAppearanceStore({ client: () => client, getAccount: () => ({ id }), getSignal: () => lifecycle.signal, saveDelay: 0 });
  return {
    store: makeStore(), makeStore, state, recovery,
    switchAccount(next) { lifecycle.abort(); lifecycle = new AbortController(); id = next; },
  };
}

function holdNextWrite(state) {
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  state.beforeWrite = async () => { entered(); await waiting; };
  return { started, release };
}

test('autosaves preserve recovery immediately and coalesce rapid color, shape, accessory, and name edits', async t => {
  const { store, state, recovery } = fixture(t);
  const first = store.saveCloudAppearance({ ...defaultAppearance, color: 'mint' });
  const latest = { ...defaultAppearance, color: 'sky', shape: 'cloud', name: '  Mochi  ', accessories: { glasses: 'round', face: 'freckles', pin: 'heart-pin' } };
  const second = store.saveCloudAppearance(latest);
  const normalized = { ...latest, name: 'Mochi' };
  assert.deepEqual(JSON.parse(recovery.get('feynman:first:appearance-recovery')), normalized);
  assert.equal(state.writes.length, 0);
  assert.deepEqual(await Promise.all([first, second]), [normalized, normalized]);
  assert.deepEqual(state.writes, [{ user_id: 'first', appearance: normalized }]);
  assert.equal(recovery.size, 0);
});

test('edits during a save run afterward and an older completion cannot discard newer recovery', async t => {
  const { store, state, recovery } = fixture(t), held = holdNextWrite(state);
  const initial = { ...defaultAppearance, color: 'mint' };
  const first = store.saveCloudAppearance(initial);
  await held.started;
  const skipped = store.saveCloudAppearance({ ...initial, shape: 'cloud' });
  const latest = { ...initial, shape: 'flower', name: 'Mochi' };
  const last = store.saveCloudAppearance(latest);
  const secondHeld = holdNextWrite(state);
  held.release();
  await secondHeld.started;
  assert.equal(state.writes.length, 2);
  assert.deepEqual(JSON.parse(recovery.get('feynman:first:appearance-recovery')), latest);
  assert.deepEqual(state.rows.get('first'), initial);
  secondHeld.release();
  await Promise.all([first, skipped, last]);
  assert.deepEqual(state.rows.get('first'), latest);
  assert.equal(recovery.size, 0);
});

test('failed autosaves retain the latest draft for reload and retry, including reset', async t => {
  const { store, makeStore, state, recovery } = fixture(t);
  state.fail = true;
  const look = { ...defaultAppearance, name: 'Offline name', color: 'mint' };
  await assert.rejects(store.saveCloudAppearance(look), /draft is preserved/);
  const reloaded = makeStore();
  assert.deepEqual(await reloaded.loadCloudAppearance(), { appearance: look, pending: true });
  state.fail = false;
  await reloaded.saveCloudAppearance(look);
  assert.deepEqual(await reloaded.loadCloudAppearance(), { appearance: look, pending: false });
  await reloaded.saveCloudAppearance(defaultAppearance);
  assert.deepEqual(state.rows.get('first'), defaultAppearance);
  assert.equal(recovery.size, 0);
});

test('a failed older save does not block a newer queued choice', async t => {
  const { store, state } = fixture(t), held = holdNextWrite(state);
  state.fail = true;
  const failed = assert.rejects(store.saveCloudAppearance({ ...defaultAppearance, color: 'mint' }));
  await held.started;
  const latest = { ...defaultAppearance, color: 'sky' };
  const saved = store.saveCloudAppearance(latest);
  state.beforeWrite = async () => { state.fail = false; };
  held.release();
  await failed;
  await saved;
  assert.deepEqual(state.rows.get('first'), latest);
});

test('account switching aborts queued and in-flight saves without writing another account or clearing recovery', async t => {
  const f = fixture(t), held = holdNextWrite(f.state);
  const first = assert.rejects(f.store.saveCloudAppearance({ ...defaultAppearance, name: 'First' }), { name: 'AbortError' });
  await held.started;
  const queued = assert.rejects(f.store.saveCloudAppearance({ ...defaultAppearance, name: 'Latest first' }), { name: 'AbortError' });
  f.switchAccount('second');
  await f.store.saveCloudAppearance({ ...defaultAppearance, name: 'Second' });
  held.release();
  await Promise.all([first, queued]);
  assert.equal(f.state.rows.has('first'), false);
  assert.equal(f.state.rows.get('second').name, 'Second');
  assert.equal(JSON.parse(f.recovery.get('feynman:first:appearance-recovery')).name, 'Latest first');
  assert.equal(f.recovery.has('feynman:second:appearance-recovery'), false);
});
