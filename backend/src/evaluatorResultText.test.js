import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonHeadline, evaluatorLabel, refinedEligibilityForDisplay } from '../../frontend/src/evaluatorResultText.ts';

test('result summaries distinguish completion, disagreement, and an unavailable evaluator', () => {
  assert.equal(comparisonHeadline(true, true), 'Both evaluators would finish this stage');
  assert.equal(comparisonHeadline(false, false), 'Both evaluators need more evidence');
  assert.equal(comparisonHeadline(true, false), 'Only the existing evaluator would finish');
  assert.equal(comparisonHeadline(false, true), 'Only the refined evaluator would finish');
  assert.equal(comparisonHeadline(undefined, false), 'The comparison is incomplete');
  assert.equal(comparisonHeadline(false, undefined), 'The comparison is incomplete');
});

test('an archived optional-criterion pass is displayed as incomplete without rewriting its evidence', () => {
  const assessment = { completion: { eligible: true }, judgments: [{ criterionId: 'one', status: 'supported', blockers: [] }, { criterionId: 'two', status: 'missing', required: false, blockers: [] }, { criterionId: 'level_task', status: 'supported', blockers: [] }] };
  assert.equal(refinedEligibilityForDisplay(assessment, [{ id: 'one' }, { id: 'two' }]), false);
  assert.equal(assessment.completion.eligible, true);
  assessment.judgments[1].status = 'supported';
  assert.equal(refinedEligibilityForDisplay(assessment, [{ id: 'one' }, { id: 'two' }]), true);
});

test('evidence codes become readable explanations without changing the underlying meaning', () => {
  assert.equal(evaluatorLabel('needs_clarification'), evaluatorLabel('unclear'));
  assert.match(evaluatorLabel('independent_transfer_check_needed'), /new situation.*without substantive help/);
  assert.match(evaluatorLabel('invalid_citation'), /did not match.*student message/);
  assert.match(evaluatorLabel('no_fair_opportunity'), /fairer question/);
  assert.equal(evaluatorLabel('status_missing'), 'Not demonstrated yet.');
  assert.equal(evaluatorLabel('future_validation_rule'), 'Future validation rule');
});
