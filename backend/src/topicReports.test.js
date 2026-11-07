import test from 'node:test';
import { primaryInstructions } from './evaluatorPrimary.js';
import { leanInstructions } from './refinedEvaluator.js';
import assert from 'node:assert/strict';
import { goalProof, itemScore, scoreJudgment, statedMistake, openSkippedGoals, assessmentPayload, buildTopicReport, researchCsv, csv, eventKey } from './topicReports.js';
import { createEvaluationContext, taskDefinition } from './evaluatorContracts.js';
import { primaryAssessmentTool, normalizePrimaryAssessment } from './evaluatorPrimary.js';

const config = { title: 'Energy', learningType: 'theoretical', assignment: { courseId: 'course', moduleId: 'topic' }, concepts: [{ id: 'energy', name: 'Energy', target: 'remember', rubric: { remember: '1. Define energy.\n2. Name its unit.' } }] };
const input = { conceptId: 'energy', level: 'remember', topic: 'Energy', learningType: 'theoretical', aspects: ['Define energy.', 'Name its unit.'], messages: [{ role: 'assistant', content: 'Define energy and name its unit.' }, { role: 'user', content: 'Energy is the capacity for work. The unit is watts.' }] };
const judgment = (patch = {}) => ({ criterionId: 'criterion_1', status: 'supported', result: 'correct', reasoning: 'valid', opportunity: 'fair', reason: 'Demonstrated.', abstentionReason: '', observations: [{ messageIndex: 1, messageId: 'u', quote: input.messages[1].content, assistance: 'none' }], contradictions: [], blockers: [], partialCredit: { awarded: false, reason: '' }, ...patch });
const assessment = (js) => ({ complete: js.every(j => j.status === 'supported'), reason: 'Evidence assessed.', criteria: js.map((j, i) => ({ aspect: input.aspects[i], status: j.status, evidence: j.observations })), task: judgment(), refined: { evaluatorVersion: 'test', judgments: js } });
const event = (js, sequence = 1, request = input) => ({ id: `event-${sequence}`, sequence, created_at: `2026-11-03T12:0${sequence}:00Z`, payload: assessmentPayload(request, assessment(js), { prompt: 'test', model: 'test' }) });
const context = events => ({ configuration: config, events, researchCode: 'code', createdAt: '2026-11-03T12:00:00Z' });

test('credit requires explicit fair and verified evidence, never an automatic half mark for ambiguity', () => {
  assert.equal(scoreJudgment(judgment()).credit, 1);
  assert.equal(scoreJudgment(judgment({ status: 'unclear', partialCredit: { awarded: true, reason: 'A correct definition but the required mechanism is missing.' } })).credit, .5);
  for (const patch of [{ status: 'unclear' }, { opportunity: 'compromised' }, { observations: [] }, { abstentionReason: 'Cannot read image.' }, { blockers: ['invalid_evidence'] }]) assert.equal(scoreJudgment(judgment(patch)).credit, null);
  assert.equal(scoreJudgment(judgment({ reasoning: 'flawed' })).credit, 0);
  assert.equal(scoreJudgment(judgment({ result: 'incorrect' })).credit, 0);
  assert.equal(scoreJudgment(judgment(), true).status, 'skipped');
  assert.equal(scoreJudgment(judgment({ status: 'unclear', partialCredit: { awarded: true, reason: 'Incomplete' }, blockers: ['independent_check_needed'] })).credit, null);
});

test('first attempts freeze while later practice improves final scores; overall task is excluded', () => {
  const first = event([judgment({ status: 'unclear', partialCredit: { awarded: true, reason: 'Correct definition; missing a required example.' } }), judgment({ criterionId: 'criterion_2', status: 'flawed', result: 'incorrect' })]);
  const final = event([judgment(), judgment({ criterionId: 'criterion_2' })], 2);
  const before = buildTopicReport(context([first]), 'session', 'early');
  const after = buildTopicReport(context([first, final]), 'session', 'completed');
  assert.equal(before.first.percent, 25); assert.equal(before.final.percent, 25);
  assert.equal(after.first.percent, 25); assert.equal(after.final.percent, 100);
  assert.equal(after.first.scored, 2); assert.equal(after.demonstrated, 2); assert.equal(after.assigned, 2);
  assert.equal(before.final.percent, 25, 'previous snapshot remains unchanged');
});

test('an assisted or ambiguous first answer cannot be replaced by a later successful attempt', () => {
  for (const initial of [judgment({ observations: [ { ...judgment().observations[0], assistance: 'hint' } ] }), judgment({ status: 'unclear' })]) {
    const first = event([initial, judgment({ criterionId: 'criterion_2', opportunity: 'not_yet', observations: [] })]);
    const later = event([judgment(), judgment({ criterionId: 'criterion_2' })], 2);
    const report = buildTopicReport(context([first, later]), 'session', 'completed');
    assert.equal(report.goals[0].firstCredit, null); assert.equal(report.goals[0].finalCredit, 1);
    assert.equal(report.first.scored, 1); assert.equal(report.fullyCovered, false);
  }
});

test('unasked, skipped and technical failures remain distinct, priorities start with errors then partial credit', () => {
  const empty = buildTopicReport(context([]), 'session', 'early');
  assert.equal(empty.final.percent, null); assert.equal(empty.final.coverage, 0);
  const e = event([judgment({ status: 'unclear', partialCredit: { awarded: true, reason: 'Missing example.' } }), judgment({ criterionId: 'criterion_2', status: 'flawed', result: 'incorrect' })]);
  const report = buildTopicReport(context([e]), 'session', 'early');
  assert.equal(report.priorities[0].goalId, 'energy:remember:2');
  assert.equal(report.priorities[1].goalId, 'energy:remember:1');
  const skipped = structuredClone(e); skipped.payload.goals[0].status = 'skipped'; skipped.payload.goals[0].credit = null;
  assert.equal(buildTopicReport(context([skipped]), 'session', 'early').goals[0].status, 'skipped');
  const missing = event([judgment({ observations: [], opportunity: 'not_yet' }), judgment({ criterionId: 'criterion_2', observations: [] })], 2);
  assert.equal(buildTopicReport(context([e, missing]), 'session', 'early').goals[0].finalCredit, .5, 'later missing evidence does not erase a scored assessment');
});

test('legacy evidence is retained without reconstructing first attempts or inventing research points', () => {
  const state = context([]);
  state.legacyDocument = { concepts: [{ ...config.concepts[0], messages: input.messages, assessments: { remember: { criteria: [{ aspect: 'Define energy.', status: 'supported', evidence: [{ quote: 'Old answer' }] }] } } }] };
  const report = buildTopicReport(state, 'session', 'early');
  assert.equal(report.goals[0].status, 'demonstrated'); assert.equal(report.goals[0].firstCredit, null); assert.equal(report.goals[0].finalCredit, null);
  assert.equal(report.goals[0].evidence[0].quote, 'Old answer'); assert.equal(report.legacy, true);
});

test('research CSVs reconcile with reports, omit personal text, default to full latest coverage and escape spreadsheet formulas', () => {
  const r = buildTopicReport(context([event([judgment(), judgment({ criterionId: 'criterion_2' })])]), 'session', 'completed');
  r.goals[0].reason = 'private student content'; r.goals[0].evidence = [{ quote: 'private transcript' }];
  const snapshots = [{ snapshotId: 'old', createdAt: '2026-11-03', report: { ...r, fullyCovered: false } }, { snapshotId: 'new', createdAt: '2026-11-04', report: r }];
  const topics = researchCsv(snapshots, 'topics');
  assert.ok(topics.includes('"new"')); assert.ok(!topics.includes('"old"')); assert.ok(topics.includes('"100"'));
  const details = researchCsv(snapshots, 'criteria');
  assert.equal(details.split('\r\n').filter(Boolean).length, 3); assert.ok(!details.includes('private'));
  assert.equal(researchCsv([snapshots[0]], 'topics').split('\r\n').filter(Boolean).length, 1);
  assert.equal(researchCsv(snapshots, 'topics', { includeIncomplete: true, history: true }).split('\r\n').filter(Boolean).length, 3);
  assert.ok(csv([{ x: '=RUN("evil")' }], ['x']).includes("'=RUN"));
  assert.equal(eventKey(input), eventKey(structuredClone(input)));
});

test('research evaluator requests explicit partial credit and assistance without loosening completion rules', () => {
  const c = createEvaluationContext({ ...input, researchScoring: true });
  const task = taskDefinition(c, 'Demonstrate recall.');
  const schema = primaryAssessmentTool(c, task).schema;
  const variant = schema.properties.judgments.items;
  assert.ok(variant.properties.partialCredit); assert.ok(variant.properties.observations.items.properties.assistance);
  const raw = { reason: 'Incomplete definition.', nextEvidenceObjective: 'Ask for the missing example.', judgments: [...c.criteria, task].map((d, index) => ({ ...judgment(), criterionId: d.id, observations: [{ messageId: c.messages[1].id, quote: input.messages[1].content, assistance: 'none', assistanceMessageIds: [] }], ...(index === 0 ? { status: 'unclear', partialCredit: { awarded: true, reason: 'Missing an example.' } } : {}) })) };
  const normalized = normalizePrimaryAssessment(raw, c, task);
  assert.equal(normalized.completion.eligible, false); assert.equal(scoreJudgment(normalized.judgments[0]).credit, .5);
  delete raw.judgments[0].partialCredit;
  assert.throws(() => normalizePrimaryAssessment(raw, c, task), /explicit partialCredit/);
});

test('negative citations can establish an incorrect final attempt, while unknown assistance never earns an initial score', () => {
  const negative = judgment({ status: 'flawed', result: 'incorrect', observations: [], contradictions: [{ messageId: 'u', messageIndex: 1, quote: input.messages[1].content, reason: 'Watts measure power.' }], blockers: ['no_valid_evidence', 'unresolved_contradiction'] });
  assert.equal(scoreJudgment(negative).credit, 0);
  const report = buildTopicReport(context([event([negative, judgment({ criterionId: 'criterion_2' })])]), 'session', 'early');
  assert.equal(report.goals[0].finalCredit, 0); assert.equal(report.goals[0].firstCredit, null);
  assert.equal(report.goals[0].firstLimitation, 'unknown_assistance_provenance'); assert.equal(report.goals[0].assisted, false);
});

test('overall independent and transfer checks remain visible without entering the score denominator', () => {
  const e = event([judgment(), judgment({ criterionId: 'criterion_2' })]);
  e.payload.conceptId = 'energy'; e.payload.level = 'remember';
  e.payload.assessment.refined.judgments.push(judgment({ criterionId: 'level_task', status: 'unclear', independentCheck: 'not_demonstrated', transferCheck: 'not_demonstrated', blockers: ['independent_transfer_check_needed'], reason: 'Demonstrate the concept independently in a changed situation.' }));
  const report = buildTopicReport(context([e]), 'session', 'early');
  assert.equal(report.final.percent, 100); assert.equal(report.final.scored, 2);
  assert.equal(report.levelChecks[0].supported, false); assert.equal(report.levelChecks[0].rubricDemonstrated, true);
  assert.equal(report.levelChecks[0].transferCheck, 'not_demonstrated');
});

test('item scores follow how each rubric item was reached', () => {
  assert.deepEqual(itemScore('demonstrated', [{ status: 'partial', replies: 2 }, { status: 'demonstrated', replies: 3 }]), { score: 1, outcome: 'correct' }, 'follow-up questions still earn full credit');
  assert.deepEqual(itemScore('demonstrated', [{ status: 'needs_work', mistake: true, replies: 1 }, { status: 'demonstrated', replies: 2 }]), { score: 0.5, outcome: 'corrected' });
  assert.deepEqual(itemScore('demonstrated', [{ status: 'needs_work', mistake: false, replies: 1 }, { status: 'demonstrated', replies: 2 }]), { score: 1, outcome: 'correct' }, 'an incomplete answer is not a mistake');
  assert.deepEqual(itemScore('demonstrated', [{ status: 'demonstrated', replies: 4 }]), { score: 1, outcome: 'correct' }, 'extra replies never reduce the score');
  assert.deepEqual(itemScore('demonstrated', [{ status: 'skipped' }, { status: 'demonstrated', replies: 1 }]), { score: 1, outcome: 'correct' }, 'an earlier skip with no false statement earns full credit');
  assert.deepEqual(itemScore('demonstrated', [{ status: 'needs_work', mistake: true }, { status: 'skipped' }, { status: 'demonstrated' }]), { score: 0.5, outcome: 'corrected' }, 'a false statement before the skip still costs half');
  assert.deepEqual(itemScore('skipped', [{ status: 'needs_work' }, { status: 'skipped' }]), { score: 0, outcome: 'skipped' });
  for (const status of ['needs_work', 'partial', 'not_assessed']) assert.deepEqual(itemScore(status), { score: null, outcome: 'unfinished' });
  assert.deepEqual(itemScore('demonstrated'), { score: 1, outcome: 'correct' }, 'older events have no reply count');
});

test('reply counts are stored per item and concept and topic totals keep unfinished items', () => {
  const longInput = { ...input, messages: [...Array(4).keys()].flatMap(i => [{ role: 'assistant', content: `Probe ${i}`, rubricFocus: input.aspects[0] }, { role: 'user', content: `Reply ${i}` }]) };
  const observation = { messageIndex: 7, messageId: 'u', quote: 'Reply 3', assistance: 'none' };
  const slow = { id: 'event-1', sequence: 1, created_at: '2026-11-03T12:01:00Z', payload: assessmentPayload(longInput, assessment([judgment({ observations: [observation] }), judgment({ criterionId: 'criterion_2', status: 'unclear', result: 'undetermined', observations: [] })]), { prompt: 'test', model: 'test' }) };
  assert.equal(slow.payload.goals[0].replies, 4);
  const report = buildTopicReport(context([slow]), 'session', 'early');
  assert.equal(report.goals[0].score, 1); assert.equal(report.goals[1].score, null);
  assert.deepEqual(report.score, { earned: 1, possible: 2, percent: 50, unfinished: 1 });
  assert.deepEqual(report.concepts, [{ id: 'energy', name: 'Energy', earned: 1, possible: 2, percent: 50, unfinished: 1 }]);
});

test('only a stated error, not an omission, costs half credit on a finished item', () => {
  assert.equal(statedMistake({ status: 'needs_work' }, { status: 'unclear', contradictions: [] }), false);
  assert.equal(statedMistake({ status: 'needs_work' }, { status: 'flawed', contradictions: [] }), true);
  assert.equal(statedMistake({ status: 'needs_work' }, { status: 'unclear', contradictions: [{ quote: 'x' }] }), true);
  const finished = (patch, createdAt) => ({ ...event([judgment(patch), judgment({ criterionId: 'criterion_2' })]), created_at: createdAt });
  const later = finished({}, '2026-11-03T12:05:00Z');
  const omission = buildTopicReport(context([finished({ status: 'unclear', result: 'incorrect', reasoning: 'unclear' }, '2026-11-03T12:01:00Z'), later]), 'session', 'completed');
  assert.deepEqual([omission.goals[0].score, omission.goals[0].outcome, omission.goals[0].proof.mistake], [1, 'correct', null]);
  const error = buildTopicReport(context([finished({ status: 'flawed', result: 'incorrect' }, '2026-11-03T12:01:00Z'), later]), 'session', 'completed');
  assert.deepEqual([error.goals[0].score, error.goals[0].outcome], [0.5, 'corrected']);
});

test('later teaching recovers a skipped earlier-level goal', () => {
  const twoLevels = { ...config, concepts: [{ ...config.concepts[0], target: 'understand', rubric: { ...config.concepts[0].rubric, understand: '1. Explain energy transfer.' } }] };
  const skip = event([judgment(), judgment({ criterionId: 'criterion_2' })]);
  skip.payload.goals[1].status = 'skipped'; skip.payload.goals[1].credit = null;
  const state = events => ({ ...context(events), configuration: twoLevels });
  assert.deepEqual(openSkippedGoals(state([skip]), 'energy', 'understand').map(g => g.id), ['energy:remember:2']);
  assert.deepEqual(openSkippedGoals(state([skip]), 'energy', 'remember'), [], 'the current level covers its own skips');
  const later = (skipRecovery, sequence) => {
    const request = { ...input, level: 'understand', aspects: ['Explain energy transfer.'] };
    const base = assessment([judgment({ status: 'unclear', result: 'undetermined', observations: [] })]);
    return { id: `event-${sequence}`, sequence, created_at: `2026-11-03T12:0${sequence}:00Z`, payload: assessmentPayload(request, { ...base, criteria: [{ aspect: request.aspects[0], status: 'needs_clarification', evidence: [] }], skipRecovery }, { prompt: 'test', model: 'test' }) };
  };
  const recovered = { id: 'energy:remember:2', level: 'remember', aspect: 'Name its unit.', credit: 1, status: 'demonstrated', mistake: false, reason: 'Named joules.', evidence: [{ messageIndex: 3, quote: 'joules' }] };
  const falseClaim = { ...recovered, credit: null, status: 'skipped', mistake: true, reason: 'Called the unit watts.' };
  const clean = buildTopicReport(state([skip, later([recovered], 2)]), 'session', 'completed').goals[1];
  assert.deepEqual([clean.status, clean.score, clean.outcome], ['demonstrated', 1, 'correct']);
  assert.deepEqual(openSkippedGoals(state([skip, later([recovered], 2)]), 'energy', 'understand'), []);
  assert.equal(openSkippedGoals(state([skip, later([falseClaim], 2)]), 'energy', 'understand').length, 1, 'a false statement leaves the item recoverable');
  const fixed = buildTopicReport(state([skip, later([falseClaim], 2), later([recovered], 3)]), 'session', 'completed').goals[1];
  assert.deepEqual([fixed.status, fixed.score, fixed.outcome, fixed.proof.mistake.reason], ['demonstrated', 0.5, 'corrected', 'Called the unit watts.']);
  assert.deepEqual([buildTopicReport(state([skip]), 'session', 'completed').goals[1].score], [0]);
});

test('evaluator prompts keep omissions out of the error category', () => {
  for (const text of [primaryInstructions, leanInstructions]) assert.match(text, /Leaving out a required part is never an error/);
});

test('skipped items count as zero in the topic score', () => {
  const skip = event([judgment(), judgment({ criterionId: 'criterion_2' })]);
  skip.payload.goals[1].status = 'skipped'; skip.payload.goals[1].credit = null;
  const report = buildTopicReport(context([skip]), 'session', 'completed');
  assert.deepEqual(report.score, { earned: 1, possible: 2, percent: 50, unfinished: 0 });
});

test('proof shows when an item was earned, what went wrong, and every attempt at a skipped item', () => {
  const reply = (content, index) => ({ evidence: [], reply: { messageIndex: index, quote: content } });
  const cite = (quote, messageIndex) => [{ messageIndex, quote }];
  const history = [
    { status: 'needs_work', mistake: true, reason: 'Used the wrong unit.', replies: 1, at: 't1', evidence: cite('watts', 1), reply: { messageIndex: 1, quote: 'The unit is watts.' } },
    { status: 'demonstrated', reason: 'Named joules.', replies: 2, at: 't2', evidence: cite('joules', 3) },
    { status: 'demonstrated', reason: 'Still right.', replies: 3, at: 't3', evidence: cite('joules again', 5) },
  ];
  const proof = goalProof('demonstrated', history);
  assert.deepEqual([proof.gotAt, proof.gotOnReply, proof.reason, proof.quote], ['t2', 2, 'Named joules.', 'joules'], 'later re-judging does not move when it was earned');
  assert.deepEqual(proof.mistake, { reason: 'Used the wrong unit.', quote: 'watts' });
  assert.deepEqual(proof.attempts, ['The unit is watts.', 'joules', 'joules again'], 'a full reply replaces its excerpt');

  const skipped = goalProof('skipped', [{ status: 'not_assessed', replies: 1, ...reply('No idea', 1) }, { status: 'not_assessed', replies: 2, ...reply('Maybe heat?', 3) }, { status: 'skipped', replies: 2, evidence: [] }]);
  assert.deepEqual([skipped.gotAt, skipped.replies, skipped.attempts], [null, 2, ['No idea', 'Maybe heat?']]);
  assert.equal(goalProof('demonstrated', [{ status: 'skipped', evidence: [] }, { status: 'demonstrated', replies: 1, at: 't', evidence: [] }]).returnedAfterSkip, true);
  assert.deepEqual(goalProof('not_assessed').attempts, []);
});

test('replies to the focused item are saved for proof, and research exports leave them out', () => {
  const answered = { ...input, messages: [{ role: 'assistant', content: 'Define energy.', rubricFocus: input.aspects[0] }, { role: 'user', content: 'I think it is a force?' }] };
  const unclear = judgment({ status: 'needs_clarification', result: 'undetermined', observations: [] });
  const e = event([unclear, judgment({ criterionId: 'criterion_2', status: 'missing', result: 'undetermined', observations: [] })], 1, answered);
  assert.deepEqual(e.payload.goals[0].reply, { messageIndex: 1, quote: 'I think it is a force?' });
  assert.equal(e.payload.goals[1].reply, undefined, 'a reply only counts for the item it answered');
  const report = buildTopicReport(context([e]), 'session', 'early');
  assert.deepEqual(report.goals[0].proof.attempts, ['I think it is a force?']);
  assert.ok(!researchCsv([{ report, id: 'snapshot', createdAt: 'now' }], 'criteria', { includeIncomplete: true }).includes('a force'));
});
