import test from 'node:test';
import assert from 'node:assert/strict';
import { screenEvaluatorRun, summarizeEvaluatorScreens, screenEvaluatorComparison, summarizeEvaluatorComparisons, evaluatorTestCases } from './evaluatorBenchmark.js';

const fixture = evaluatorTestCases.find(c => c.id === 'evaluator-recall');
const record = (eligible, status) => ({ legacy: { assessment: { complete: eligible, criteria: [{ status }] } }, refined: { assessment: { completion: { eligible }, judgments: [{ criterionId: 'criterion_1', status }] } } });

test('shadow metrics distinguish a caught primary mistake from an unnecessary block and a missed mistake', () => {
  const incomplete = { ...fixture, expected: { eligible: false, criterionStatuses: [['missing']] } };
  const run = record(true, 'supported');
  run.shadow = { status: 'completed', assessment: record(false, 'missing').refined.assessment };
  const caught = screenEvaluatorComparison(incomplete, run);
  assert.equal(caught.shadow.outcome, 'caught_false_completion');
  assert.equal(run.refined.assessment.completion.eligible, true, 'Screening never mutates a primary');
  const harmed = screenEvaluatorComparison(fixture, run);
  assert.equal(harmed.shadow.outcome, 'blocked_correct_completion');
  run.shadow.assessment = record(true, 'supported').refined.assessment;
  const missed = screenEvaluatorComparison(incomplete, run);
  assert.equal(missed.shadow.outcome, 'missed_false_completion');
  const confirmed = screenEvaluatorComparison(fixture, run);
  assert.equal(confirmed.shadow.outcome, 'confirmed_correct_completion');
  const report = summarizeEvaluatorComparisons([caught, harmed, missed, confirmed]);
  assert.deepEqual(report.shadow, { reviewed: 4, falseCompletionOpportunities: 2, caughtFalseCompletions: 1, missedFalseCompletions: 1, blockedCorrectCompletions: 1, confirmedCorrectCompletions: 1, errors: 0, unscorable: 0 });
});

test('no reviewed false-positive primaries means no evidence of a shadow catch rate', () => {
  const run = record(false, 'missing'); run.shadow = { status: 'not_run' };
  const result = screenEvaluatorComparison(fixture, run);
  assert.equal(result.shadow.outcome, 'not_run');
  assert.equal(summarizeEvaluatorComparisons([result]).shadow.falseCompletionOpportunities, 0);
  run.shadow = { status: 'error', error: 'Timeout' };
  assert.equal(summarizeEvaluatorComparisons([screenEvaluatorComparison(fixture, run)]).shadow.errors, 1);
});

test('paired comparisons count wins in both directions and identify metadata advantages', () => {
  const run = record(true, 'supported'); run.legacy.assessment.complete = false;
  const improved = screenEvaluatorComparison({ ...fixture, tags: ['policy-sensitive'] }, run);
  const report = summarizeEvaluatorComparisons([improved]);
  assert.equal(report.paired.refinedOnlyMatched, 1);
  assert.equal(report.paired.legacyOnlyMatched, 0);
  assert.equal(report.paired.policySensitive, 1);
  assert.equal(improved.policySensitive, true);
});

test('challenge contrasts preserve paired positive/negative controls and never leak expectations into inputs', () => {
  const cases = evaluatorTestCases.filter(c => c.tags.includes('challenge'));
  assert.equal(cases.length, 16);
  for (const pair of new Set(cases.map(c => c.pairId))) {
    const members = cases.filter(c => c.pairId === pair);
    assert.equal(members.length, 2, pair);
    assert.deepEqual(new Set(members.map(c => c.expected.eligible)), new Set([true, false]), pair);
    assert.deepEqual(members[0].input.aspects, members[1].input.aspects);
    for (const c of members) {
      assert.equal(c.input.expected, undefined);
      assert.equal(c.input.pairId, undefined);
      assert.equal(c.input.rationale, undefined);
    }
  }
});

test('borderline cases preserve identical multi-turn context and rubrics across opposite-outcome controls', () => {
  const cases = evaluatorTestCases.filter(c => c.tags.includes('borderline'));
  assert.equal(cases.length, 12);
  for (const pair of new Set(cases.map(c => c.pairId))) {
    const members = cases.filter(c => c.pairId === pair);
    assert.equal(members.length, 2, pair);
    assert.deepEqual(new Set(members.map(c => c.expected.eligible)), new Set([false, true]));
    assert.deepEqual(members[0].input.aspects, members[1].input.aspects);
    assert.deepEqual(members[0].input.messages.slice(0, -1), members[1].input.messages.slice(0, -1));
    for (const c of members) {
      assert.equal(c.input.messages.length, 4);
      assert.equal(c.input.expected, undefined);
      assert.equal(c.input.evaluatorCriteria, undefined, 'No extra policy metadata advantage');
    }
  }
});
test('live-run screening checks rubric status and level completion independently', () => {
  assert.equal(screenEvaluatorRun(fixture, record(true, 'supported'), 'refined').status, 'matched');
  const mismatch = screenEvaluatorRun(fixture, record(true, 'missing'), 'refined');
  assert.equal(mismatch.status, 'mismatched'); assert.equal(mismatch.checks[0].passed, true); assert.equal(mismatch.checks[1].passed, false);
  const blocked = screenEvaluatorRun(fixture, record(false, 'supported'), 'refined');
  assert.equal(blocked.status, 'mismatched'); assert.equal(blocked.unnecessaryBlock, true);
});

test('long conversations preserve original turn order and matched histories across opposite outcomes', () => {
  const cases = evaluatorTestCases.filter(c => c.tags.includes('long-conversation'));
  assert.equal(cases.length, 6);
  for (const pair of new Set(cases.map(c => c.pairId))) {
    const members = cases.filter(c => c.pairId === pair);
    assert.equal(members.length, 2);
    assert.deepEqual(members[0].input.aspects, members[1].input.aspects);
    assert.deepEqual(members[0].input.messages.slice(0, -1), members[1].input.messages.slice(0, -1));
    assert.deepEqual(new Set(members.map(c => c.expected.eligible)), new Set([false, true]));
    for (const c of members) {
      assert.equal(c.input.messages.length, 26);
      assert.equal(new Set(c.input.messages.map(m => m.id)).size, 26);
      c.input.messages.forEach((m, i) => assert.equal(m.role, i % 2 ? 'user' : 'assistant'));
      assert.equal(c.input.expected, undefined);
      assert.equal(c.input.evaluatorCriteria, undefined, 'No extra policy metadata');
      assert.equal(c.expected.criterionStatuses.length, c.input.aspects.length);
    }
  }
});
test('live screening normalizes legacy clarification labels without losing completion errors', () => {
  const incomplete = { ...fixture, expected: { eligible: false, criterionStatuses: [['unclear']] } };
  assert.equal(screenEvaluatorRun(incomplete, record(false, 'needs_clarification'), 'legacy').status, 'matched');
  assert.equal(screenEvaluatorRun(incomplete, record(true, 'needs_clarification'), 'legacy').falseCompletion, true);
});
test('model errors and abstentions are not counted as successful accuracy outcomes', () => {
  const error = screenEvaluatorRun(fixture, { refined: { assessment: null, error: 'Transport failed' } }, 'refined');
  assert.equal(error.status, 'error');
  const abstention = record(false, 'unclear'); abstention.refined.assessment.judgments[0].abstentionReason = 'Reference conflict';
  assert.equal(screenEvaluatorRun(fixture, abstention, 'refined').status, 'abstained');
  const summary = summarizeEvaluatorScreens([{ legacy: error, refined: error }, { legacy: screenEvaluatorRun(fixture, record(false, 'unclear'), 'legacy'), refined: screenEvaluatorRun(fixture, record(true, 'supported'), 'refined') }]);
  assert.equal(summary.refined.matched, 1); assert.equal(summary.refined.errors, 1); assert.equal(summary.legacy.unnecessaryBlocks, 1);
});
