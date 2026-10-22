import test from 'node:test';
import assert from 'node:assert/strict';
import { learnerStateFromAssessment } from './strategyLearnerState.js';

const input = { messages: [{ role: 'assistant', content: 'An assistant answer.' }, { role: 'user', content: 'My answer.', review: { explanation: 'My review.' }, boardImage: 'image' }] };

test('rubric-derived diagnosis separates supported, missing, unclear and flawed evidence', () => {
  const state = learnerStateFromAssessment(input, { nextQuestionFocus: 'Explain the boundary condition.', criteria: [
    { aspect: 'Storage', status: 'supported', evidence: [{ messageIndex: 1, quote: 'My answer.' }] },
    { aspect: 'Charge', status: 'flawed', evidence: [{ messageIndex: 1, quote: 'My answer.' }] },
    { aspect: 'Conditions', status: 'needs_clarification', evidence: [] },
    { aspect: 'Energy', status: 'missing', evidence: [] },
  ], task: { status: 'needs_clarification', evidence: [] } });
  assert.deepEqual(state.understands, ['Storage']);
  assert.match(state.potentialMisconceptions[0], /Charge.*not evidence of a stable misconception/);
  assert.deepEqual(state.missingConcepts, ['Not yet demonstrated: Energy']);
  assert.ok(state.uncertainty.some(s => s.includes('Conditions')));
  assert.equal(state.diagnosticObjective, 'Explain the boundary condition.');
  assert.deepEqual(state.evidence, [{ messageIndex: 1, quote: 'My answer.' }]);
});

test('reused citations reject assistant text, fabricated quotes and joined fields', () => {
  const citations = [{ messageIndex: 0, quote: 'An assistant answer.' }, { messageIndex: 1, quote: 'Invented.' }, { messageIndex: 1, quote: 'My answer.My review.' }, { messageIndex: 1, quote: 'My review.' }, { messageIndex: 1, quote: '[Whiteboard image]' }];
  const state = learnerStateFromAssessment(input, { criteria: [{ aspect: 'Review', status: 'needs_clarification', evidence: citations }] });
  assert.deepEqual(state.evidence, citations.slice(3));
  assert.deepEqual(state.understands, []);
});

test('no evidence produces uncertainty and a rubric objective without inventing beliefs', () => {
  const state = learnerStateFromAssessment(input, { criteria: [{ aspect: 'Explain the mechanism', status: 'missing', evidence: [] }] });
  assert.deepEqual(state.potentialMisconceptions, []);
  assert.deepEqual(state.evidence, []);
  assert.match(state.uncertainty[0], /No verified learner quotation/);
  assert.equal(state.diagnosticObjective, 'Elicit evidence for: Explain the mechanism');
});
