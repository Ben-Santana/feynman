import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { playgroundEntries } from '../../frontend/src/playgroundStore.ts';

test('concurrent saves from stale tabs preserve separate tests and later per-ID updates', async t => {
  const old = globalThis.indexedDB; globalThis.indexedDB = new IDBFactory();
  t.after(() => { globalThis.indexedDB = old; });
  await playgroundEntries('a', { id: 'baseline', updatedAt: 1, content: 'original' });
  const staleA = await playgroundEntries('a'), staleB = await playgroundEntries('a');
  assert.deepEqual(staleA, staleB);
  await Promise.all([playgroundEntries('a', { id: 'one', updatedAt: 2 }), playgroundEntries('a', { id: 'two', updatedAt: 3 })]);
  await playgroundEntries('a', { id: 'baseline', updatedAt: 4, content: 'completed' });
  await playgroundEntries('a', { id: 'three', updatedAt: 5 });
  const rows = await playgroundEntries('a');
  assert.equal(rows.length, 4);
  assert.equal(rows.find(r => r.id === 'baseline').content, 'completed');
  assert.deepEqual(await playgroundEntries('other-account'), []);
});

test('legacy browser saves migrate atomically without losing records', async t => {
  const old = globalThis.indexedDB; globalThis.indexedDB = new IDBFactory();
  t.after(() => { globalThis.indexedDB = old; });
  await playgroundEntries('a');
  const db = await new Promise(resolve => { const req = indexedDB.open('feynman-accounts', 1); req.onsuccess = () => resolve(req.result); });
  await new Promise(resolve => { const tx = db.transaction('account-data', 'readwrite'); tx.objectStore('account-data').put([{ id: 'legacy', updatedAt: 1 }], 'a:playground'); tx.oncomplete = resolve; });
  db.close();
  await Promise.all([playgroundEntries('a', { id: 'new-a', updatedAt: 2 }), playgroundEntries('a', { id: 'new-b', updatedAt: 3 })]);
  assert.deepEqual((await playgroundEntries('a')).map(r => r.id), ['new-b', 'new-a', 'legacy']);
});
