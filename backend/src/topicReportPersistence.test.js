import test from 'node:test';
import assert from 'node:assert/strict';
import { courseFixture } from './courses.test.js';
import { createTopicReportService } from './topicReportService.js';

const student = '11111111-1111-4111-8111-111111111111';
const instructor = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const moduleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const configuration = { version: 1, session: { title: 'Energy', learningType: 'theoretical', concepts: [{ id: 'energy', name: 'Energy', target: 'remember', rubric: { remember: '1. Define energy.\n2. Name its unit.', understand: '', apply: '', analyze: '' } }] } };

async function fixture(t) {
  const f = await courseFixture(t);
  await f.as(instructor);
  const course = await f.one("select * from public.create_course('Physics','open')");
  await f.one('select public.save_course_module($1,$2,$3,$4,0)', [course.id, moduleId, 'Energy', configuration]);
  await f.one('select public.publish_course_module($1,1)', [moduleId]);
  await f.as(student);
  await f.one('select public.join_course($1)', [course.code]);
  const session = await f.one('select * from public.start_course_module($1)', [moduleId]);
  await f.db.exec('reset role');
  // Admin export is restricted independently of the service role.
  await f.db.query("update public.user_roles set role='admin' where user_id=$1", [other]);
  const client = { async rpc(name, args) {
    try {
      const keys = Object.keys(args);
      const data = await f.one(`select public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) as data`, Object.values(args));
      return { data: data.data };
    } catch (error) { return { error }; }
  } };
  const service = createTopicReportService(() => client);
  const input = { assignmentSessionId: session.id, assignmentConceptId: 'energy', level: 'remember', messages: [{ role: 'assistant', content: 'Define energy and name its unit.' }, { role: 'user', content: 'Energy is the capacity to do work. Its unit is the joule.' }] };
  const account = { id: student, role: 'student' };
  const assessment = { complete: true, criteria: ['Define energy.', 'Name its unit.'].map(aspect => ({ aspect, status: 'supported', evidence: [{ messageIndex: 1, quote: input.messages[1].content }] })), task: { status: 'supported' }, refined: { evaluatorVersion: 'test', judgments: [1,2].map(i => ({ criterionId: `criterion_${i}`, status: 'supported', result: 'correct', reasoning: 'valid', opportunity: 'fair', reason: 'Correct answer.', abstentionReason: '', observations: [{ messageId: 'u', messageIndex: 1, quote: input.messages[1].content, assistance: 'none' }], contradictions: [], blockers: [] })) } };
  return { ...f, course, session, service, input, account, assessment };
}

test('server persistence freezes configuration, deduplicates retries, preserves snapshots and checks watermark', async t => {
  const f = await fixture(t);
  const prepared = await f.service.prepare(f.account, f.input);
  assert.equal(await f.service.report(f.account, f.session.id, { save: true, mode: 'completed', onlyIfComplete: true }), null);
  assert.equal(prepared.input.topic, 'Energy'); assert.equal(prepared.input.researchScoring, true);
  const a = await f.service.record(f.account, prepared, f.assessment, { prompt: 'v1', model: 'm1' });
  const b = await f.service.record(f.account, prepared, { ...f.assessment, complete: false }, { prompt: 'v2', model: 'm2' });
  assert.equal(a.payload.goals[0].attempt, 1); assert.equal(a.id, b.id); assert.equal(b.payload.versions.prompt, 'v1'); assert.equal(b.payload.assessment.complete, true);
  const report = await f.service.report(f.account, f.session.id, { save: true, mode: 'completed' });
  const retry = await f.service.report(f.account, f.session.id, { save: true, mode: 'completed' });
  assert.equal(report.id, retry.id); assert.equal(report.report.first.percent, 100); assert.equal(report.report.final.percent, 100);
  assert.deepEqual(report.report.score, { earned: 2, possible: 2, percent: 100, unfinished: 0 });
  assert.equal(Number((await f.one('select public.completed_topic_score($1,$2) as score', [student, f.session.id])).score), 100);
  await f.db.query(`update public.topic_report_snapshots set report = (report - 'score') || '{"final":{"percent":90}}'::jsonb where id=$1`, [report.id]);
  assert.equal(Number((await f.one('select public.completed_topic_score($1,$2) as score', [student, f.session.id])).score), 90, 'older snapshots keep their final percentage');
  assert.equal((await f.service.report(f.account, f.session.id, { save: true, mode: 'completed' })).report.score.percent, 100, 'an older snapshot at this watermark still shows the current score');
  await f.db.query('update public.topic_report_snapshots set report = $2 where id=$1', [report.id, report.report]);
  const next = { ...f.input, messages: [...f.input.messages, { role: 'assistant', content: 'Try again with a new example.' }, { role: 'user', content: 'Energy is force.' }] };
  const changed = structuredClone(f.assessment); changed.complete = false; changed.refined.judgments[0].status = 'flawed'; changed.refined.judgments[0].result = 'incorrect'; changed.refined.judgments[0].observations[0].messageIndex = 3;
  await f.service.record(f.account, await f.service.prepare(f.account, next), changed, { prompt: 'v1' });
  const resumed = await f.service.report(f.account, f.session.id, { save: true });
  assert.notEqual(resumed.id, report.id); assert.equal(resumed.report.first.percent, 100); assert.equal(resumed.report.final.percent, 50);
  const original = await f.service.report(f.account, f.session.id, { snapshotId: report.id });
  assert.equal(original.report.final.percent, 100); assert.equal(original.snapshots.length, 2);
  await assert.rejects(f.db.query('select public.save_topic_report($1,$2,0,\'early\',\'{}\')', [student, f.session.id]), error => error.code === 'PT409');
  const admin = { id: other, role: 'admin' };
  const exported = await f.service.export(admin, new URLSearchParams({ kind: 'topics', course: f.course.id }));
  assert.ok(exported.content.includes('"50"')); assert.ok(!exported.content.includes(student)); assert.ok(!exported.content.includes('Energy is force'));
  const roster = await f.service.export(admin, new URLSearchParams({ kind: 'roster', course: f.course.id }));
  assert.ok(roster.content.includes(`${student}@example.com`)); assert.ok(roster.content.includes(report.report.researchCode));
});

test('a completed topic awards 100 points once, even after a restart', async t => {
  const f = await fixture(t);
  const points = async () => { await f.as(student); const { wallet } = await f.one('select public.cosmetic_wallet() as wallet'); await f.db.exec('reset role'); return wallet.points; };
  await f.service.record(f.account, await f.service.prepare(f.account, f.input), { ...f.assessment, complete: false }, { prompt: 'v1' });
  await f.service.report(f.account, f.session.id, { save: true, mode: 'early' });
  assert.equal(await points(), 0, 'an early finish earns nothing');

  await f.service.record(f.account, await f.service.prepare(f.account, { ...f.input, messages: [...f.input.messages, { role: 'user', content: 'Energy is the capacity to do work.' }] }), f.assessment, { prompt: 'v1' });
  await f.service.report(f.account, f.session.id, { save: true, mode: 'completed' });
  await f.service.report(f.account, f.session.id, { save: true, mode: 'completed' });
  assert.equal(await points(), 100);

  await f.as(student);
  const fresh = await f.one('select * from public.restart_course_module($1,$2)', [moduleId, f.session.id]);
  await f.db.exec('reset role');
  await f.service.record(f.account, await f.service.prepare(f.account, { ...f.input, assignmentSessionId: fresh.id }), f.assessment, { prompt: 'v1' });
  await f.service.report(f.account, fresh.id, { save: true, mode: 'completed' });
  assert.equal(await points(), 100, 'a restarted topic does not pay twice');
});

test('restarting an assigned module keeps its previous report and resumes a clean attempt', async t => {
  const f = await fixture(t);
  const args = [moduleId, f.session.id];
  const restart = 'select * from public.restart_course_module($1,$2)';
  await f.as(student);
  await assert.rejects(f.one(restart, args), error => error.code === '23514');
  await f.db.exec('reset role');
  await f.service.record(f.account, await f.service.prepare(f.account, f.input), f.assessment, { prompt: 'v1' });
  const saved = await f.service.report(f.account, f.session.id, { save: true, mode: 'completed' });

  await f.as(student);
  const fresh = await f.one(restart, args);
  assert.notEqual(fresh.id, f.session.id);
  assert.deepEqual(fresh.document.session.assignment, f.session.document.session.assignment);
  assert.equal(fresh.document.session.concepts[0].passed, 0);
  assert.equal(fresh.document.session.concepts[0].messages.length, 1);
  assert.equal((await f.one(restart, args)).id, fresh.id);
  assert.equal((await f.one('select * from public.start_course_module($1)', [moduleId])).id, fresh.id);
  await f.as(instructor);
  await assert.rejects(f.one(restart, args), error => error.code === '42501');
  await f.db.exec('reset role');
  assert.equal((await f.service.report(f.account, f.session.id, { snapshotId: saved.id })).report.final.percent, 100);
  assert.equal((await f.service.report(f.account, fresh.id)).report.first.scored, 0);
});

test('students cannot write score tables, call server RPCs, export, read other reports, or access after leaving', async t => {
  const f = await fixture(t);
  await f.service.prepare(f.account, f.input);
  await f.as(student);
  for (const table of ['research_participants','topic_score_topics','topic_assessment_events','topic_report_snapshots']) {
    await assert.rejects(f.db.query(`select * from public.${table}`), /permission denied/);
    await assert.rejects(f.db.query(`delete from public.${table}`), /permission denied/);
  }
  await assert.rejects(f.db.query('select public.topic_score_context($1,$2)', [student, f.session.id]), /permission denied/);
  await f.db.exec('reset role');
  await assert.rejects(f.service.prepare({ id: other }, f.input), error => error.status === 403);
  await assert.rejects(f.service.export(f.account, new URLSearchParams({ kind: 'roster', course: f.course.id })), error => error.status === 403);
  await assert.rejects(f.db.query('select public.topic_research_export($1,$2,false)', [student, f.course.id]), /Admin access required/);
  await f.as(student);
  await f.one('select public.leave_course($1)', [f.course.id]);
  await f.db.exec('reset role');
  await assert.rejects(f.service.report(f.account, f.session.id), error => error.status === 403);
});

test('research exports exclude unsigned exempt accounts while reports remain available', async t => {
  const f = await fixture(t);
  await f.db.query('delete from public.signed_consents where user_id=$1', [student]);
  await assert.rejects(f.service.prepare(f.account, f.input), error => error.status === 403);
  await f.db.query('update public.profiles set consent_required=false where id=$1', [student]);
  const prepared = await f.service.prepare(f.account, f.input);
  await f.service.record(f.account, prepared, f.assessment, { prompt: 'v1' });
  await f.service.report(f.account, f.session.id, { save: true });
  const exported = await f.service.export({ id: other, role: 'admin' }, new URLSearchParams({ kind: 'topics', course: f.course.id }));
  assert.equal(exported.content.trim().split('\r\n').length, 1);
});

test('personal topics can extend their target while previously scored goals remain fixed', async t => {
  const f = await fixture(t);
  const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const document = structuredClone(configuration); document.session.started = true;
  document.session.concepts[0].messages = [];
  await f.db.query('insert into public.learning_sessions(owner_id,id,title,document) values($1,$2,$3,$4)', [student, id, 'Energy', document]);
  const input = { ...f.input, assignmentSessionId: undefined, assignmentConceptId: undefined, sessionId: id, conceptId: 'energy' };
  const initial = await f.service.prepare(f.account, input);
  assert.equal(initial.state.configuration.concepts[0].target, 'remember');
  await f.service.record(f.account, initial, f.assessment, { prompt: 'v1' });
  document.session.concepts[0].target = 'understand'; document.session.concepts[0].rubric.understand = 'Explain energy transfer.';
  await f.db.query('update public.learning_sessions set document=$1 where owner_id=$2 and id=$3', [document, student, id]);
  const extended = await f.service.prepare(f.account, { ...input, level: 'understand' });
  assert.equal(extended.input.criterion, 'Explain energy transfer.');
  const report = await f.service.report(f.account, id, { save: true });
  assert.equal(report.report.assigned, 3); assert.equal(report.report.first.scored, 2);
  document.session.concepts[0].rubric.remember = 'Changed goal.';
  await f.db.query('update public.learning_sessions set document=$1 where owner_id=$2 and id=$3', [document, student, id]);
  await assert.rejects(f.service.prepare(f.account, input), error => error.status === 409 && /change scored goals/.test(error.message));
});
