import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_KEY, accessories, accessorySlots, characterColors, characterShapes, defaultAppearance, equipAccessory, loadAppearance, normalizeAppearance, normalizeCharacterName, saveAppearance } from '../../frontend/src/characterAppearance.ts';

function storage(t) {
  const values = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  t.after(() => { globalThis.localStorage = original; });
  return values;
}

test('body palette changes hue while retaining the original red HSV saturation and value', () => {
  const saturationAndValue = hex => {
    const channels = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16));
    const maximum = Math.max(...channels);
    return [(maximum - Math.min(...channels)) / maximum, maximum / 255];
  };
  const original = saturationAndValue(characterColors[0].hex);
  for (const color of characterColors) assert.deepEqual(saturationAndValue(color.hex), original);
  assert.equal(new Set(characterColors.map(color => color.hex)).size, characterColors.length);
});

test('a saved complete outfit survives reload without changing defaults', t => {
  storage(t);
  let look = { ...normalizeAppearance(null), color: 'mint', shape: 'cloud' };
  for (const slot of accessorySlots) look = equipAccessory(look, slot.id, accessories.find(item => item.slot === slot.id).id);
  const saved = saveAppearance(look);
  assert.deepEqual(loadAppearance(), saved);
  assert.equal(Object.values(saved.accessories).filter(Boolean).length, 3);
  assert.ok(Object.values(defaultAppearance.accessories).every(item => item === null));
});

test('slot replacement and removal preserve the other selections', () => {
  const first = equipAccessory(equipAccessory(defaultAppearance, 'glasses', 'round'), 'pin', 'star-pin');
  const replacement = equipAccessory(first, 'pin', 'flower-pin');
  assert.equal(replacement.accessories.pin, 'flower-pin');
  assert.equal(replacement.accessories.glasses, 'round');
  assert.equal(first.accessories.pin, 'star-pin');
  assert.equal(equipAccessory(replacement, 'glasses', null).accessories.pin, 'flower-pin');
  assert.equal(equipAccessory(first, 'pin', 'round').accessories.pin, null);
});

test('malformed, unknown-version and unavailable storage recover to the original character', t => {
  const values = storage(t);
  for (const value of ['{bad json', 'null', '42', JSON.stringify({ version: 7, appearance: { color: 'mint' } })]) {
    values.set(APPEARANCE_KEY, value);
    assert.deepEqual(loadAppearance(), defaultAppearance);
  }
  globalThis.localStorage = { getItem() { throw new Error('Storage blocked'); } };
  assert.deepEqual(loadAppearance(), defaultAppearance);
});

test('invalid IDs and items in the wrong slots are discarded without losing valid choices', () => {
  assert.deepEqual(normalizeAppearance({ color: 'mint', shape: 'unknown', accessories: { headwear: 'round', glasses: 'heart-specs', neckwear: 'unknown', face: false, pin: 'flower-pin' } }), {
    name: 'Feynman', color: 'mint', shape: 'hexagon', accessories: { glasses: null, face: null, pin: 'flower-pin' },
  });
});

test('save failures propagate so the studio can retain its draft and show an error', t => {
  storage(t);
  globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => saveAppearance(defaultAppearance), /Quota exceeded/);
});

test('every catalog choice can round-trip and all remaining accessories belong to a valid slot', t => {
  storage(t);
  assert.equal(accessories.length, 9);
  assert.equal(new Set(accessories.map(item => item.id)).size, 9);
  for (const color of characterColors) for (const shape of characterShapes) {
    for (const accessory of accessories) {
      const look = equipAccessory({ ...defaultAppearance, color: color.id, shape: shape.id }, accessory.slot, accessory.id);
      assert.deepEqual(saveAppearance(look), loadAppearance());
      assert.equal(loadAppearance().accessories[accessory.slot], accessory.id);
    }
  }
});


test('previous saved looks discard retired items while preserving color, shape and remaining accessories', t => {
  const values = storage(t);
  values.set(APPEARANCE_KEY, JSON.stringify({ version: 1, appearance: { color: 'lavender', shape: 'cloud', accessories: { headwear: 'wizard', neckwear: 'scarf', glasses: 'sunglasses', face: 'freckles', pin: 'heart-pin' } } }));
  assert.deepEqual(loadAppearance(), { name: 'Feynman', color: 'lavender', shape: 'cloud', accessories: { glasses: null, face: 'freckles', pin: 'heart-pin' } });
});


test('character names persist with the look and old records default to Feynman', t => {
  const values = storage(t);
  saveAppearance({ ...defaultAppearance, name: '  Mochi  ' });
  assert.equal(loadAppearance().name, 'Mochi');
  values.set(APPEARANCE_KEY, JSON.stringify({ version: 1, appearance: { color: 'mint' } }));
  assert.equal(loadAppearance().name, 'Feynman');
  assert.equal(loadAppearance().color, 'mint');
});

test('character names recover safely from blank, invalid and oversized values', () => {
  for (const name of ['', '   ', null, 42, {}, '\u0000']) assert.equal(normalizeCharacterName(name), 'Feynman');
  assert.equal(normalizeCharacterName('a'.repeat(100)).length, 32);
  assert.equal(normalizeCharacterName('  René 🐣  '), 'René 🐣');
});
