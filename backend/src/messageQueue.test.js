import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreLearning } from '../../frontend/src/learningFlow.ts';
import { moveQueued, recoverSend, restoreQueue } from '../../frontend/src/messageQueue.ts';

const item = (id) => ({ id, text: id });

test('moveQueued reorders in both directions and clamps the target', () => {
  const queue = ['a', 'b', 'c'].map(item);
  assert.deepEqual(moveQueued(queue, 0, 2).map((q) => q.id), ['b', 'c', 'a']);
  assert.deepEqual(moveQueued(queue, 2, 0).map((q) => q.id), ['c', 'a', 'b']);
  assert.deepEqual(moveQueued(queue, 0, 9).map((q) => q.id), ['b', 'c', 'a']);
});

test('a failed send returns to an empty composer', () => {
  const session = recoverSend({ draft: '', queue: [], sending: 'first' }, 'first');
  assert.equal(session.draft, 'first');
  assert.equal(session.sending, undefined);
  assert.ok(!session.queuePaused);
});

test('a failed send goes ahead of the queue and pauses it', () => {
  const session = recoverSend({ draft: '', queue: [item('next')], sending: 'first' }, 'first');
  assert.deepEqual(session.queue.map((q) => q.text), ['first', 'next']);
  assert.equal(session.queuePaused, true);
});

test('a failed send never overwrites newer typing', () => {
  const session = recoverSend({ draft: 'still typing', sending: 'first' }, 'first');
  assert.equal(session.draft, 'still typing');
  assert.deepEqual(session.queue.map((q) => q.text), ['first']);
});

test('a failed review or action pauses waiting messages', () => {
  assert.equal(recoverSend({ draft: '', queue: [item('next')] }).queuePaused, true);
  assert.equal(recoverSend({ draft: '', queue: [] }).queuePaused, false);
});

test('restoring keeps the queue paused and recovers an interrupted send', () => {
  const session = restoreQueue({ draft: '', queue: [item('next'), { id: 1 }, null], sending: 'first' });
  assert.deepEqual(session.queue.map((q) => q.text), ['first', 'next']);
  assert.equal(session.queuePaused, true);
  assert.equal(session.sending, undefined);
  assert.equal(restoreQueue({ draft: '', queue: 'bad' }).queuePaused, false);
});

test('restoreLearning carries the queue through saved sessions', () => {
  const restored = restoreLearning({ activeId: 'c', started: true, concepts: [{ id: 'c', name: 'Topic', target: 'analyze', messages: [{ role: 'assistant', content: 'hi' }], queue: [item('next')] }] });
  assert.deepEqual(restored.concepts[0].queue.map((q) => q.text), ['next']);
  assert.equal(restored.concepts[0].queuePaused, true);
});
