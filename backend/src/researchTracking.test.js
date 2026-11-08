import test from 'node:test';
import assert from 'node:assert/strict';
import { courseFixture } from './courses.test.js';
import { createTopicReportService } from './topicReportService.js';

const student = '11111111-1111-4111-8111-111111111111';
const instructor = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const outsider = '44444444-4444-4444-8444-444444444444';
const moduleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const configuration = { version: 1, session: { title: 'Energy', learningType: 'theoretical', concepts: [
  { id: 'energy', name: 'Energy', target: 'remember', rubric: { remember: '1. Define energy.\n2. Name its unit.', understand: '', apply: '', analyze: '' } },
  { id: 'power', name: 'Power', target: 'remember', rubric: { remember: '1. Define power.', understand: '', apply: '', analyze: '' } },
] } };
const submit = 'select public.submit_topic_prequestionnaire($1,$2,$3,$4) as result';

async function fixture(t) {
  const f = await courseFixture(t);
  await f.db.query("update public.user_roles set role='admin' where user_id=$1", [admin]);
  await f.as(instructor);
  const course = await f.one("select * from public.create_course('Physics','open')");
  await f.one('select public.save_course_module($1,$2,$3,$4,0)', [course.id, moduleId, 'Energy', configuration]);
  await f.one('select public.publish_course_module($1,1)', [moduleId]);
  await f.as(student);
  await f.one('select public.join_course($1)', [course.code]);
  const rows = async (kind, target = course.id) => { await f.as(admin); const { data } = await f.one('select public.admin_research_rows($1,$2) as data', [kind, target]); return data; };
  const analytics = async (target = course.id) => { await f.as(admin); return (await f.one('select public.admin_research_analytics(30,$1) as data', [target])).data; };
  return { ...f, course, rows, analytics };
}

test('assigned topics require valid pre-topic answers before the first start, and restarts skip them', async t => {
  const f = await fixture(t);
  await assert.rejects(f.one('select * from public.start_course_module($1)', [moduleId]), error => error.code === 'FA010');
  await assert.rejects(f.one(submit, [moduleId, 'sometimes', 50, { energy: 3, power: 3 }]), /studied this topic/);
  await assert.rejects(f.one(submit, [moduleId, 'none', 55, { energy: 3, power: 3 }]), /expected score/);
  await assert.rejects(f.one(submit, [moduleId, 'none', 50, { energy: 3 }]), /Rate every concept/);
  await assert.rejects(f.one(submit, [moduleId, 'none', 50, { energy: 3, power: 6 }]), /Rate every concept/);
  await assert.rejects(f.one(submit, [moduleId, 'none', 50, { energy: 3, gravity: 2 }]), /Rate every concept/);
  await assert.rejects(f.db.query('select * from public.topic_prequestionnaires'), error => error.code === '42501');

  await f.one(submit, [moduleId, 'this_course', 70, { energy: 4, power: 2 }]);
  // A repeated submission keeps the first answers.
  await f.one(submit, [moduleId, 'none', 10, { energy: 1, power: 1 }]);
  const session = await f.one('select * from public.start_course_module($1)', [moduleId]);
  await f.db.exec('reset role');
  const saved = (await f.db.query('select * from public.topic_prequestionnaires')).rows;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].session_id, session.id);
  assert.equal(saved[0].expected_score, 70);
  assert.deepEqual(saved[0].concept_ratings, { energy: 4, power: 2 });
  assert.deepEqual(saved[0].concepts.map(c => c.name), ['Energy', 'Power']);

  // Outsiders are not enrolled; started topics cannot be answered retroactively.
  await f.as(outsider);
  await assert.rejects(f.one(submit, [moduleId, 'none', 50, { energy: 3, power: 3 }]), error => error.code === '42501');
  await f.db.exec('reset role');
  await f.db.query('delete from public.topic_prequestionnaires');
  await f.as(student);
  await assert.rejects(f.one(submit, [moduleId, 'none', 50, { energy: 3, power: 3 }]), /already started/);
});

test('restarting a topic started before the questions existed does not ask for them', async t => {
  const f = await fixture(t);
  await f.one(submit, [moduleId, 'none', 50, { energy: 3, power: 3 }]);
  const first = await f.one('select * from public.start_course_module($1)', [moduleId]);
  await f.db.exec('reset role');
  await f.db.query('delete from public.topic_prequestionnaires');
  await f.db.query("insert into public.topic_score_topics(student_id,session_id,configuration,session_created_at) values($1,$2,'{}',now())", [student, first.id]);
  await f.db.query("insert into public.topic_report_snapshots(student_id,session_id,watermark,finish_mode,report) values($1,$2,0,'early','{}')", [student, first.id]);
  await f.as(student);
  const restarted = await f.one('select * from public.restart_course_module($1,$2)', [moduleId, first.id]);
  assert.notEqual(restarted.id, first.id);
});

test('activity logging deduplicates repeats, ignores other accounts\' sessions and skips non-students', async t => {
  const f = await fixture(t);
  await f.one(submit, [moduleId, 'none', 50, { energy: 3, power: 3 }]);
  const session = await f.one('select * from public.start_course_module($1)', [moduleId]);
  await f.one("select public.log_activity('app_open')");
  await f.one("select public.log_activity('app_open')");
  await f.one("select public.log_activity('topic_open',$1)", [session.id]);
  await f.one("select public.log_activity('active',$1)", [session.id]);
  await f.one("select public.log_activity('active',null)");
  await assert.rejects(f.one("select public.log_activity('hacked')"), /valid activity/);
  await assert.rejects(f.db.query('select * from public.activity_events'), error => error.code === '42501');
  await f.as(outsider);
  await f.one("select public.log_activity('topic_open',$1)", [session.id]);
  await f.as(instructor);
  await f.one("select public.log_activity('app_open')");
  await f.db.exec('reset role');
  const events = (await f.db.query('select user_id,event,session_id,course_id,module_id from public.activity_events order by id')).rows;
  assert.deepEqual(events.map(e => [e.user_id, e.event]), [[student, 'app_open'], [student, 'topic_open'], [student, 'active'], [outsider, 'topic_open']]);
  assert.equal(events[1].course_id, f.course.id);
  assert.equal(events[1].module_id, moduleId);
  assert.equal(events[3].session_id, null, 'another student\'s session is not recorded');
});

test('admin analytics and exports compare pre-topic answers with completed scores using participant codes', async t => {
  const f = await fixture(t);
  await f.one(submit, [moduleId, 'elsewhere', 80, { energy: 5, power: 2 }]);
  const session = await f.one('select * from public.start_course_module($1)', [moduleId]);
  await f.one("select public.log_activity('app_open')");
  await f.one("select public.log_activity('active',$1)", [session.id]);
  await f.db.exec('reset role');
  await f.db.query("insert into public.topic_score_topics(student_id,session_id,configuration,session_created_at) values($1,$2,$3,now())", [student, session.id, { assignment: { courseId: f.course.id } }]);
  await f.db.query("insert into public.topic_report_snapshots(student_id,session_id,watermark,finish_mode,report) values($1,$2,1,'completed',$3)", [student, session.id,
    { first: { percent: 50 }, final: { percent: 75 }, score: { percent: 60 }, concepts: [{ id: 'energy', percent: 100 }, { id: 'power', percent: 0 }] }]);

  await f.as(student);
  await assert.rejects(f.one('select public.admin_research_analytics(30,null)'), error => error.code === '42501');
  await assert.rejects(f.one("select public.admin_research_rows('activity',null)"), error => error.code === '42501');

  const data = await f.analytics();
  assert.equal(data.engagement.participants, 1);
  assert.equal(data.engagement.active, 1);
  assert.equal(data.engagement.minutes, 1);
  assert.equal(data.engagement.topicsCompleted, 1);
  assert.equal(data.engagement.cohorts[0].size, 1);
  assert.equal(data.engagement.cohorts[0].active[0], 1);
  assert.equal(data.prequestionnaire.responses, 1);
  assert.equal(Number(data.prequestionnaire.gap), 20);
  assert.deepEqual(data.prequestionnaire.points.map(p => [p.expected, Number(p.actual)]), [[80, 60]]);
  assert.equal(Number(data.prequestionnaire.ratings[4].score), 100);
  assert.equal(Number(data.prequestionnaire.ratings[1].score), 0);
  assert.equal(data.prequestionnaire.prior.elsewhere, 1);
  assert.ok((await f.one('select public.admin_research_courses() as data')).data.some(c => c.id === f.course.id));

  const pre = await f.rows('prequestionnaire');
  assert.equal(pre.length, 2);
  assert.deepEqual(pre.map(r => [r.concept_id, r.self_rating, r.concept_score]), [['energy', 5, '100'], ['power', 2, '0']]);
  assert.equal(pre[0].topic_score, '60'); assert.equal(pre[0].research_final_score, '75');
  const summary = await f.rows('activity_summary');
  assert.equal(summary.length, 1);
  assert.equal(summary[0].active_minutes, 1); assert.equal(summary[0].assigned_topics_started, 1); assert.equal(summary[0].assigned_topics_completed, 1);
  const activity = await f.rows('activity');
  assert.equal(activity.length, 2);
  const text = JSON.stringify([pre, summary, activity]);
  assert.ok(!text.includes(student) && !text.includes('@example.com'), 'exports never contain account IDs or emails');
  assert.equal(pre[0].participant_code, summary[0].participant_code);

  // Unsigned accounts are not research participants.
  await f.db.exec('reset role');
  await f.db.query('delete from public.signed_consents where user_id=$1', [student]);
  await f.db.query('update public.profiles set consent_required=false where id=$1', [student]);
  assert.equal((await f.rows('prequestionnaire')).length, 0);
  assert.equal((await f.analytics()).engagement.participants, 0);
  await assert.rejects(f.rows('names'), /valid export/);
});
