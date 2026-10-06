import test from 'node:test';
import assert from 'node:assert/strict';
import { FRUIT_FLY_MODEL, fruitFlyBuzz, fruitFlyResponse, spaceTapStreak } from '../../frontend/src/fruitFly.ts';
import { aiHeaders, aiPreferences, localAIResponse, saveAIPreferences } from '../../frontend/src/aiPreferences.ts';

const buzz = /^Bzz Bzz (banana|mango|peach|pear|strawberry|pineapple|watermelon|cherry) bzz bzzzz$/;

test('unlock requires eight distinct rapid taps and expires stale taps', () => {
  let taps = [];
  for (let i = 0; i < 7; i++) taps = spaceTapStreak(taps, i * 200, false);
  assert.equal(taps.length, 7);
  assert.deepEqual(spaceTapStreak(taps, 1400, true), taps);
  assert.equal(spaceTapStreak(taps, 1400, false).length, 8);
  assert.deepEqual(spaceTapStreak(taps, 4000, false), [4000]);
});

test('local joke replies have only buzz text and never assess learning', () => {
  assert.equal(fruitFlyBuzz(() => 0), 'Bzz Bzz banana bzz bzzzz');
  for (let i = 0; i < 100; i++) {
    const reply = fruitFlyResponse('/api/chat', {});
    assert.match(reply.message, buzz);
    assert.equal(reply.assessment, null);
    assert.equal(reply.paper, undefined);
    assert.deepEqual(reply.calls, []);
  }
});

test('rubrics preserve names, fill targeted levels with buzzes, and leave later levels empty', () => {
  const result = fruitFlyResponse('/api/rubric', { concepts: [{ name: 'Energy', target: 'understand' }, { name: 'Gravity', target: 'analyze' }] });
  assert.deepEqual(result.concepts.map(concept => concept.name), ['Energy', 'Gravity']);
  assert.match(result.concepts[0].rubric.remember, buzz);
  assert.match(result.concepts[0].rubric.understand, buzz);
  assert.equal(result.concepts[0].rubric.apply, '');
  assert.equal(result.concepts[0].rubric.analyze, '');
  Object.values(result.concepts[1].rubric).forEach(text => assert.match(text, buzz));
  assert.match(fruitFlyResponse('/api/developer/rubric', {}).items[0], buzz);
  assert.match(fruitFlyResponse('/api/concept-suggestions', {}).names[0], buzz);
});

test('selection persists, bypasses AI locally, and never leaks the joke model into provider headers', t => {
  const values = new Map();
  t.mock.method(globalThis, 'fetch', () => { throw new Error('No network allowed'); });
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  globalThis.window = { dispatchEvent: () => {} };
  t.after(() => { globalThis.localStorage = originalStorage; globalThis.window = originalWindow; });
  saveAIPreferences({ provider: 'chatgpt', accountId: '', model: FRUIT_FLY_MODEL });
  assert.equal(aiPreferences().model, FRUIT_FLY_MODEL);
  assert.match(localAIResponse('/api/chat', {}).message, buzz);
  assert.ok(localAIResponse('/api/rubric', { concepts: [{ name: 'Energy', target: 'remember' }] }).concepts.length);
  assert.equal(aiHeaders()['X-Feynman-Model'], undefined);
  assert.equal(localAIResponse('/api/developer/prompts'), undefined);
  saveAIPreferences({ provider: 'chatgpt', accountId: '', model: 'real-model' });
  assert.equal(localAIResponse('/api/chat', {}), undefined);
  assert.equal(aiHeaders()['X-Feynman-Model'], 'real-model');
});
