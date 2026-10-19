import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSetting, matchingSettings } from '../../frontend/src/settingsSearch.ts';

test('settings search finds individual controls across categories', () => {
  assert.deepEqual(matchingSettings('profile', 'display name'), ['displayName']);
  assert.deepEqual(matchingSettings('profile', 'email'), ['email']);
  assert.deepEqual(matchingSettings('profile', 'password'), ['password']);
  assert.deepEqual(matchingSettings('ai', 'model'), ['model']);
  assert.deepEqual(matchingSettings('ai', 'usage'), ['usage']);
  assert.deepEqual(matchingSettings('profile', 'model'), []);
  assert.deepEqual(matchingSettings('display', 'dark'), ['darkMode']);
  assert.deepEqual(matchingSettings('display', 'font sizing'), ['fontSize']);
  assert.deepEqual(matchingSettings('display', 'dyslexic'), ['boldWordStarts']);
  assert.deepEqual(matchingSettings('display', 'Arial'), ['fontFamily']);
});

test('settings search handles casing, whitespace, aliases, and multiple terms', () => {
  assert.equal(matchesSetting('displayName', '  NICKNAME  '), true);
  assert.equal(matchesSetting('password', ' WPI   security '), true);
  assert.equal(matchesSetting('provider', 'claude api'), true);
  assert.equal(matchesSetting('provider', 'claude password'), false);
  assert.equal(matchingSettings('profile', '   ').length, 4);
  assert.deepEqual(matchingSettings('ai', 'no-such-setting'), []);
});
