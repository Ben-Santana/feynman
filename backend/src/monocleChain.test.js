import test from 'node:test';
import assert from 'node:assert/strict';
import { MonocleChain, MONOCLE_CHAIN_LENGTH } from '../../frontend/src/monocleChain.ts';

function simulate(hz, seconds, anchorAt, scale = 1) {
  const chain = new MonocleChain(anchorAt(0), scale);
  for (let frame = 1; frame <= hz * seconds; frame++) chain.advance(anchorAt(frame / hz), 1 / hz);
  return chain;
}

test('the chain stays attached and its links keep their length during rapid motion', () => {
  const chain = new MonocleChain({ x: 0, y: 0 });
  for (let frame = 1; frame <= 1200; frame++) {
    const t = frame / 120;
    const anchor = { x: 18 * Math.sin(t * 5), y: 8 * Math.sin(t * 3) };
    chain.advance(anchor, 1 / 120);
    assert.ok(Math.hypot(chain.points[0].x - anchor.x, chain.points[0].y - anchor.y) < 1e-9);
    const linkLength = MONOCLE_CHAIN_LENGTH / (chain.points.length - 1);
    for (let index = 1; index < chain.points.length; index++) {
      const a = chain.points[index - 1], b = chain.points[index];
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y));
      assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - linkLength) < .1);
    }
  }
});

test('the free end lags a moving lens and settles below it once motion stops', () => {
  const anchorAt = t => ({ x: Math.min(t, 1) * 20, y: 0 });
  const moving = simulate(60, 1, anchorAt);
  assert.ok(moving.points.at(-1).x < 19);
  // Independent links bend, rather than rotating a rigid SVG curve.
  const turning = simulate(60, .4, anchorAt);
  const top = turning.points[1], bottom = turning.points.at(-1);
  assert.ok(Math.abs((top.x - 8) / top.y - (bottom.x - 8) / bottom.y) > .01);
  const settled = simulate(60, 8, anchorAt).points.at(-1);
  assert.ok(Math.abs(settled.x - 20) < .01);
  assert.ok(Math.abs(settled.y - MONOCLE_CHAIN_LENGTH) < .1);
});

test('fixed physics steps give the same response at different refresh rates', () => {
  const anchorAt = t => ({ x: Math.min(t, 1) * 20, y: 0 });
  const expected = simulate(60, 2, anchorAt).points;
  for (const hz of [30, 120, 144]) {
    const actual = simulate(hz, 2, anchorAt).points;
    actual.forEach((point, index) => {
      assert.ok(Math.hypot(point.x - expected[index].x, point.y - expected[index].y) < .001);
    });
  }
});

test('screen scale preserves the chain proportions and motion', () => {
  const anchorAt = t => ({ x: Math.min(t, 1) * 20, y: 0 });
  const expected = simulate(60, 2, anchorAt).points;
  for (const scale of [.25, 2, 4]) {
    const actual = simulate(60, 2, t => ({ x: anchorAt(t).x * scale, y: 0 }), scale).points;
    actual.forEach((point, index) => {
      assert.ok(Math.hypot(point.x / scale - expected[index].x, point.y / scale - expected[index].y) < .001);
    });
  }
});

test('zero elapsed time does not add energy or move the chain', () => {
  const chain = new MonocleChain({ x: 0, y: 0 });
  const before = structuredClone(chain.points);
  chain.advance({ x: 0, y: 0 }, 0);
  assert.deepEqual(chain.points, before);
});

test('browser points with prototype coordinate getters work as anchors', () => {
  // DOMPoint coordinates are accessors, so spreading one drops x and y.
  const anchor = Object.create({ get x() { return 12; }, get y() { return 5; } });
  const chain = new MonocleChain(anchor);
  for (let frame = 0; frame < 120; frame++) chain.advance(anchor, 1 / 60);
  for (const point of chain.points) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  assert.ok(Math.abs(chain.points.at(-1).x - 12) < .01);
});
