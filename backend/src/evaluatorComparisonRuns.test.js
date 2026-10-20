import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatorHistoryLimit, loadEvaluatorHistory, saveEvaluatorHistory, runEvaluatorBatch } from '../../frontend/src/evaluatorComparisonRuns.ts';

const run = i => ({ runId: `run-${i}`, generatedAt: '2026-10-18T12:00:00Z', case: { id: 'sample', title: 'Original title', messages: [{ role: 'user', content: 'Original evidence' }] }, legacy: { assessment: null }, refined: { assessment: null }, shadow: { status: 'not_run' }, calls: [{ request: 'Original request', response: 'Original response' }] });
const memory = () => { let stored = null; return { getItem: () => stored, setItem: (_, value) => { stored = value; } }; };

test('evaluator history survives reload with original fixture and trace snapshots, bounded to latest 40', () => {
  assert.equal(evaluatorHistoryLimit, 40);
  const storage = memory();
  const entries = Array.from({ length: evaluatorHistoryLimit + 5 }, (_, i) => run(i));
  assert.equal(saveEvaluatorHistory(entries, storage), '');
  entries[0].case.messages[0].content = 'Changed in memory';
  const restored = loadEvaluatorHistory(storage);
  assert.equal(restored.entries.length, evaluatorHistoryLimit);
  assert.equal(restored.entries[0].case.messages[0].content, 'Original evidence');
  assert.deepEqual(restored.entries[0].calls, run(0).calls);
  assert.equal(saveEvaluatorHistory([], storage), '');
  assert.deepEqual(loadEvaluatorHistory(storage).entries, []);
});

test('corrupt/unavailable storage and quota failures are reported without overwriting previously saved results', () => {
  assert.match(loadEvaluatorHistory({ getItem: () => '{bad' }).notice, /could not be loaded/);
  assert.deepEqual(loadEvaluatorHistory({ getItem: () => '[null, {}]' }).entries, []);
  const storage = memory(); saveEvaluatorHistory([run(1)], storage);
  const quotaStorage = { getItem: storage.getItem, setItem: () => { throw new Error('Quota'); } };
  assert.match(saveEvaluatorHistory([run(2)], quotaStorage), /could not be saved/);
  assert.equal(loadEvaluatorHistory(storage).entries[0].runId, 'run-1');
});

test('batch requests run sequentially, report progress, and retain each completed result immediately', async () => {
  const order = [], saved = [], progress = [];
  await runEvaluatorBatch(['a', 'b', 'c'], async item => {
    order.push(`start ${item}`); await Promise.resolve(); order.push(`finish ${item}`); return item.toUpperCase();
  }, (item, result) => { saved.push([item, result]); order.push(`save ${item}`); }, (item, index, total) => progress.push([item, index, total]), new AbortController().signal);
  assert.deepEqual(order, ['start a', 'finish a', 'save a', 'start b', 'finish b', 'save b', 'start c', 'finish c', 'save c']);
  assert.deepEqual(saved, [['a', 'A'], ['b', 'B'], ['c', 'C']]);
  assert.deepEqual(progress, [['a', 1, 3], ['b', 2, 3], ['c', 3, 3]]);
});

test('cancelling a batch prevents later requests and retains earlier completed comparisons', async () => {
  const controller = new AbortController(); const saved = [], requested = [];
  await assert.rejects(runEvaluatorBatch(['a', 'b', 'c'], async item => { requested.push(item); return item; }, (item, result) => { saved.push(result); controller.abort(); }, () => {}, controller.signal), { name: 'AbortError' });
  assert.deepEqual(requested, ['a']); assert.deepEqual(saved, ['a']);
});

test('a later request failure stops the batch without discarding completed results', async () => {
  const saved = [], requested = [];
  await assert.rejects(runEvaluatorBatch(['a', 'b', 'c'], async item => { requested.push(item); if (item === 'b') throw new Error('Provider unavailable'); return item; }, (_, result) => saved.push(result), () => {}, new AbortController().signal), /Provider unavailable/);
  assert.deepEqual(requested, ['a', 'b']); assert.deepEqual(saved, ['a']);
});
