import test from 'node:test';
import assert from 'node:assert/strict';
import { characterColors, defaultAppearance, normalizeAppearance } from '../../frontend/src/characterAppearance.ts';
import { courseBannerPresets } from '../../frontend/src/courseAppearance.ts';
import { dashboardBanner } from '../../frontend/src/dashboardAppearance.ts';

test('courses offer every dashboard banner with the same preset', () => {
  assert.deepEqual(courseBannerPresets.map(preset => preset.id), characterColors.map(color => color.id));
  for (const color of characterColors) {
    assert.deepEqual(dashboardBanner(color.id), { type: 'preset', preset: color.id });
  }
});

test('saved avatar colors determine the banner and invalid colors fall back to the default avatar', () => {
  for (const color of characterColors) {
    const restored = normalizeAppearance(JSON.parse(JSON.stringify({ ...defaultAppearance, color: color.id })));
    assert.deepEqual(dashboardBanner(restored.color), dashboardBanner(color.id));
  }
  assert.deepEqual(dashboardBanner(normalizeAppearance({ color: 'unknown' }).color), dashboardBanner(defaultAppearance.color));
  assert.deepEqual(dashboardBanner('unknown'), dashboardBanner(defaultAppearance.color));
  assert.deepEqual(dashboardBanner('toString'), dashboardBanner(defaultAppearance.color));
});
