import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionProgress } from '../../frontend/src/sessionProgress.ts';

const concept = (overrides = {}) => ({ target: 'understand', passed: 0, rubric: { remember: '1. Define voltage.\n2. Identify units.', understand: '1. Explain voltage.', apply: '', analyze: '' }, assessments: {}, ...overrides });
test('completion counts goals across concepts and only through selected targets', () => {
  assert.deepEqual(sessionProgress([concept({ passed: 1 }), concept({ target: 'remember' })]), { completed: 2, total: 5, percent: 40 });
});
test('active goals count supported and skipped items, without counting duplicates or partial credit', () => {
  const criteria = [{ aspect: 'Define voltage.', status: 'supported' }, { aspect: 'Define voltage.', status: 'supported' }, { aspect: 'Identify units.', status: 'missing', skipped: true }, { aspect: 'Explain voltage.', status: 'supported' }];
  assert.deepEqual(sessionProgress([concept({ assessments: { remember: { criteria } } })]), { completed: 2, total: 3, percent: 67 });
});
test('100 percent requires a finished session, including the final Analyze assessment', () => {
  assert.equal(sessionProgress([concept({ target: 'remember', assessments: { remember: { criteria: [{ aspect: 'Define voltage.', status: 'supported' }, { aspect: 'Identify units.', status: 'supported' }] } } })]).percent, 99);
  assert.equal(sessionProgress([concept({ passed: 2 })]).percent, 100);
  assert.equal(sessionProgress([concept({ target: 'analyze', passed: 3, finalSummary: 'Finished.' })]).percent, 100);
});
test('empty sessions and legacy rubrics remain bounded', () => {
  assert.deepEqual(sessionProgress([]), { completed: 0, total: 0, percent: 0 });
  assert.deepEqual(sessionProgress([concept({ passed: 1, rubric: {} })]), { completed: 1, total: 2, percent: 50 });
});
