import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const student = '11111111-1111-4111-8111-111111111111';
const instructor = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const outsider = '44444444-4444-4444-8444-444444444444';
const pending = '55555555-5555-4555-8555-555555555555';
const moduleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export async function courseFixture(t, beforeMigration = async () => {}) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, last_sign_in_at timestamptz);
    create table auth.identities (user_id uuid references auth.users(id), provider text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text unique);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(regexp_replace(name, '/[^/]+$', ''), '/') $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role, supabase_auth_admin;
    grant select, insert, update, delete on storage.objects to authenticated;
  `);
  const folder = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(folder)).filter(file => file.endsWith('.sql')).sort()) {
    await beforeMigration(db, file);
    await db.exec(await readFile(new URL(file, folder), 'utf8'));
  }
  for (const [id, role] of [[student,'student'],[instructor,'instructor'],[other,'instructor'],[outsider,'student'],[pending,'student']]) {
    await db.query(`insert into auth.users values ($1,$2,now(),'{"provider":"email"}',$3,now())`, [id, `${id}@example.com`, JSON.stringify({ role })]);
    await db.query(`insert into auth.identities values ($1,'email')`,[id]);
    // Course tests exercise accounts that have completed the consent step.
    await db.query(`insert into public.signed_consents values ($1,'informed-consent-v1',$2,'Test Participant',$3,now(),'Test consent',$4,$2)`, [id, 'a'.repeat(64), `${id}@example.com`, 'b'.repeat(100)]);
    if (id !== pending) await db.query('update public.profiles set approved=true where id=$1',[id]);
  }
  async function as(id, role = 'authenticated') {
    await db.exec(`reset role; set role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id || '']);
    await db.query(`select set_config('request.jwt.claims','{"amr":[{"method":"password"}]}',false)`);
  }
  const one = async (sql, args = []) => (await db.query(sql,args)).rows[0];
  return { db, as, one };
}
const doc = (name = 'Energy') => ({ version: 1, session: { title: name, learningType: 'quantitative', files: [{ path: `${instructor}/source/private` }], concepts: [{ id: 'energy', name, target: 'understand', rubric: { remember: 'Defines energy.', understand: 'Explains energy transfer.', apply: '', analyze: '' } }], messages: ['private instructor work'] } });

test('course people shares teacher and enrolled identities with avatars only within the course', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  const course = await one("select * from public.create_course('Physics','open')");
  const people = async (id = course.id) => (await one('select public.course_people($1) as people', [id])).people;
  assert.deepEqual((await people()).map(person => person.id), [instructor]);
  await as(student);
  await one('select public.join_course($1)', [course.code]);
  const avatar = { color: 'sky', shape: 'star', accessories: { glasses: 'round', face: null, pin: 'heart-pin' } };
  await db.query('insert into public.user_customizations(user_id,appearance) values($1,$2)', [student, { ...avatar, name: 'Private avatar name', dashboardBanner: { path: 'PRIVATE/banner' } }]);
  await as(outsider);
  await one('select public.join_course($1)', [course.code]);
  await as(instructor);
  await one("select public.set_course_enrollment($1,'approval')", [course.id]);
  await db.exec('reset role');
  await db.query('update public.profiles set approved=true where id=$1', [pending]);
  await as(pending);
  await one('select public.join_course($1)', [course.code]);
  await assert.rejects(people(), error => error.code === '42501');
  await as(instructor);
  assert.equal((await people()).length, 4);
  await one("select public.decide_course_enrollment($1,$2,'rejected')", [course.id, pending]);
  assert.equal((await people()).length, 4);
  await as(pending);
  await assert.rejects(people(), error => error.code === '42501');
  await as(student);
  const roster = await people();
  assert.equal(roster[0].id, instructor);
  assert.equal(roster[0].role, 'instructor');
  assert.deepEqual(roster.map(person => person.id).sort(), [instructor, student, outsider].sort());
  assert.deepEqual(roster.find(person => person.id === student).appearance, avatar);
  assert.deepEqual(Object.keys(roster[0]).sort(), ['appearance', 'id', 'name', 'role']);
  assert.ok(!JSON.stringify(roster).includes('PRIVATE'));
  assert.equal((await db.query('select * from public.profiles')).rows.length, 1);
  assert.equal((await db.query('select * from public.user_customizations')).rows.length, 1);
  await assert.rejects(one('select public.course_progress($1)', [course.id]), error => error.code === '42501');
  await assert.rejects(people(moduleId), error => error.code === '42501');
  await one('select public.leave_course($1)', [course.id]);
  await assert.rejects(people(), error => error.code === '42501');
  await as(other);
  await assert.rejects(people(), error => error.code === '42501');
  await db.exec('reset role');
  await db.query('update public.profiles set approved=false where id=$1', [outsider]);
  await as(outsider);
  await assert.rejects(people(), error => error.code === '42501');
  await as(null, 'anon');
  await assert.rejects(people(), error => error.code === '42501');
});

test('module deletion requires its owning instructor and removes only that module and its assignments', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  const course = await one("select * from public.create_course('Modules','open')");
  const draftId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const keepId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  for (const id of [moduleId, draftId, keepId]) await one('select public.save_course_module($1,$2,$3,$4,0)', [course.id, id, 'Energy', doc()]);
  await one('select public.publish_course_module($1,1)', [moduleId]);
  await one('select public.publish_course_module($1,1)', [keepId]);
  await as(student);
  await one('select public.join_course($1)', [course.code]);
  const removedSession = await one('select * from public.start_course_module($1)', [moduleId]);
  const keptSession = await one('select * from public.start_course_module($1)', [keepId]);
  const personalId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await one('select public.save_learning_session($1,$2,$3,0)', [personalId, 'Personal', { version: 1, session: { title: 'Personal' } }]);
  for (const id of [student, other, outsider, pending]) {
    await as(id);
    await assert.rejects(one('select public.delete_course_module($1,2)', [moduleId]), error => error.code === '42501');
  }
  await as('', 'anon');
  await assert.rejects(one('select public.delete_course_module($1,2)', [moduleId]), error => error.code === '42501');
  await as(instructor);
  await assert.rejects(one('delete from public.course_modules where id=$1', [moduleId]), error => error.code === '42501');
  for (const revision of [0, 1, null]) await assert.rejects(one('select public.delete_course_module($1,$2)', [moduleId, revision]), error => error.code === '40001');
  await db.exec('reset role');
  assert.equal((await one('select count(*)::int as count from public.course_assignments')).count, 2);
  await db.query('update public.profiles set approved=false where id=$1', [instructor]);
  await as(instructor);
  await assert.rejects(one('select public.delete_course_module($1,2)', [moduleId]), error => error.code === '42501');
  await db.exec('reset role');
  await db.query('update public.profiles set approved=true where id=$1', [instructor]);
  await as(instructor);
  await one('select public.delete_course_module($1,2)', [moduleId]);
  await one('select public.delete_course_module($1,1)', [draftId]);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select id from public.course_modules')).rows, [{ id: keepId }]);
  assert.deepEqual((await db.query('select module_id,session_id from public.course_assignments')).rows, [{ module_id: keepId, session_id: keptSession.id }]);
  assert.equal((await one('select count(*)::int as count from public.learning_sessions where id=$1', [removedSession.id])).count, 0);
  assert.equal((await one('select count(*)::int as count from public.learning_sessions')).count, 2);
  assert.equal((await one('select count(*)::int as count from public.courses')).count, 1);
  assert.equal((await one('select count(*)::int as count from public.course_enrollments')).count, 1);
  await as(student);
  await assert.rejects(one('select public.start_course_module($1)', [moduleId]), error => error.code === '42501');
});

test('leaving removes only the student enrollment and pin, revokes module access, and preserves progress for rejoining', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  const course = await one("select * from public.create_course('Physics','open')");
  const retained = await one("select * from public.create_course('Keep this course','open')");
  await one('select public.set_course_pin($1,true)', [course.id]);
  await one('select public.save_course_module($1,$2,$3,$4,0)', [course.id, moduleId, 'Energy', doc()]);
  await one('select public.publish_course_module($1,1)', [moduleId]);
  await as(outsider);
  await one('select public.join_course($1)', [course.code]);
  await one('select public.set_course_pin($1,true)', [course.id]);
  await as(student);
  for (const joined of [course, retained]) {
    await one('select public.join_course($1)', [joined.code]);
    await one('select public.set_course_pin($1,true)', [joined.id]);
  }
  let session = await one('select * from public.start_course_module($1)', [moduleId]);
  session.document.session.concepts[0].passed = 1;
  session.document.session.concepts[0].messages.push({ role: 'user', content: 'Saved answer' });
  session = await one('select * from public.save_learning_session($1,$2,$3,1)', [session.id, session.title, session.document]);
  await one('select public.leave_course($1)', [course.id]);
  assert.deepEqual((await db.query('select id from public.courses')).rows, [{ id: retained.id }]);
  assert.deepEqual((await db.query('select course_id from public.course_enrollments')).rows, [{ course_id: retained.id }]);
  assert.deepEqual((await db.query('select course_id from public.course_pins')).rows, [{ course_id: retained.id }]);
  assert.equal((await one('select count(*)::int as count from public.course_modules')).count, 0);
  assert.deepEqual((await one('select * from public.learning_sessions where id=$1', [session.id])).document, session.document);
  assert.equal((await one('select count(*)::int as count from public.course_assignments')).count, 1);
  await assert.rejects(one('select public.start_course_module($1)', [moduleId]), error => error.code === '42501');
  await assert.rejects(one('select public.assignment_chat_configuration($1,$2)', [session.id, 'energy']), error => error.code === '42501');
  await assert.rejects(one('select public.save_learning_session($1,$2,$3,$4)', [session.id, session.title, session.document, session.revision]), error => error.code === '42501');
  await assert.rejects(one('select public.set_course_pin($1,true)', [course.id]), error => error.code === '42501');
  await as(instructor);
  const progress = (await one('select public.course_progress($1) as progress', [course.id])).progress;
  assert.deepEqual(progress.map(value => value.studentId), [outsider]);
  assert.equal((await one('select count(*)::int as count from public.course_pins')).count, 1);
  await as(outsider);
  assert.equal((await one('select count(*)::int as count from public.course_enrollments')).count, 1);
  assert.equal((await one('select count(*)::int as count from public.course_pins')).count, 1);
  await as(student);
  assert.equal((await one('select * from public.join_course($1)', [course.code])).status, 'enrolled');
  const resumed = await one('select * from public.start_course_module($1)', [moduleId]);
  assert.equal(resumed.id, session.id);
  assert.deepEqual(resumed.document, session.document);
  await one('select public.leave_course($1)', [course.id]);
  await as(instructor);
  await one("select public.set_course_enrollment($1,'approval')", [course.id]);
  await as(student);
  assert.equal((await one('select * from public.join_course($1)', [course.code])).status, 'pending');
  await assert.rejects(one('select public.start_course_module($1)', [moduleId]), error => error.code === '42501');
  await as(instructor);
  await one("select public.decide_course_enrollment($1,$2,'enrolled')", [course.id, student]);
  await as(student);
  assert.equal((await one('select * from public.start_course_module($1)', [moduleId])).id, session.id);
});

test('students can cancel pending requests but cannot clear rejections or leave for another account', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  const course = await one("select * from public.create_course('Approval required','approval')");
  const leave = () => one('select public.leave_course($1)', [course.id]);
  await as(student);
  await one('select public.join_course($1)', [course.code]);
  await one('select public.set_course_pin($1,true)', [course.id]);
  await assert.rejects(one('delete from public.course_enrollments where course_id=$1', [course.id]), error => error.code === '42501');
  for (const id of [instructor, other, outsider, pending]) {
    await as(id);
    await assert.rejects(leave(), error => error.code === '42501');
  }
  await as('', 'anon');
  await assert.rejects(leave(), error => error.code === '42501');
  await db.exec('reset role');
  await db.query('update public.profiles set approved=false where id=$1', [student]);
  await as(student);
  await assert.rejects(leave(), error => error.code === '42501');
  await db.exec('reset role');
  await db.query('update public.profiles set approved=true where id=$1', [student]);
  await as(student);
  await leave();
  assert.equal((await one('select count(*)::int as count from public.course_enrollments')).count, 0);
  assert.equal((await one('select count(*)::int as count from public.course_pins')).count, 0);
  assert.equal((await one('select * from public.join_course($1)', [course.code])).status, 'pending');
  await as(instructor);
  await one("select public.decide_course_enrollment($1,$2,'rejected')", [course.id, student]);
  await one("select public.set_course_enrollment($1,'open')", [course.id]);
  await as(student);
  await assert.rejects(leave(), error => error.code === '42501');
  assert.equal((await one('select * from public.join_course($1)', [course.code])).status, 'rejected');
});

test('course pins persist per account and reject inaccessible courses and direct writes', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  const course = await one("select * from public.create_course('Pinned course','open')");
  const pin = value => one('select public.set_course_pin($1,$2)', [course.id, value]);
  await pin(true); await pin(true);
  assert.equal((await one('select count(*)::int as count from public.course_pins')).count, 1);
  await assert.rejects(pin(null), error => error.code === '23514');
  await assert.rejects(one('insert into public.course_pins values($1,$2)', [other, course.id]), error => error.code === '42501');
  for (const id of [other, outsider, pending]) {
    await as(id);
    assert.equal((await one('select count(*)::int as count from public.course_pins')).count, 0);
    await assert.rejects(pin(true), error => error.code === '42501');
  }
  await as(student);
  await one('select public.join_course($1)', [course.code]);
  await pin(true);
  assert.deepEqual((await db.query('select user_id,course_id from public.course_pins')).rows, [{ user_id: student, course_id: course.id }]);
  await pin(false); await pin(false);
  assert.equal((await one('select count(*)::int as count from public.course_pins')).count, 0);
  await as(instructor);
  assert.equal((await one('select count(*)::int as count from public.course_pins')).count, 1);
  await as('', 'anon');
  await assert.rejects(pin(true), error => error.code === '42501');
});

test('only the owning instructor can delete a course and its dependent data', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  const course = await one("select * from public.create_course('Delete this course','open')");
  const retained = await one("select * from public.create_course('Keep this course','open')");
  await one('select public.set_course_pin($1,true)', [course.id]);
  await one('select public.set_course_pin($1,true)', [retained.id]);
  await one('select public.save_course_module($1,$2,$3,$4,0)', [course.id, moduleId, 'Energy', doc()]);
  await one('select public.publish_course_module($1,1)', [moduleId]);
  await as(student);
  await one('select public.join_course($1)', [course.code]);
  const assigned = await one('select * from public.start_course_module($1)', [moduleId]);
  await one('select public.set_course_pin($1,true)', [course.id]);
  const personalId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await one('select public.save_learning_session($1,$2,$3,0)', [personalId, 'Personal work', { version: 1, session: { title: 'Personal work' } }]);
  for (const id of [student, other, outsider, pending]) {
    await as(id);
    await assert.rejects(one('select public.delete_course($1)', [course.id]), error => error.code === '42501');
  }
  await as('', 'anon');
  await assert.rejects(one('select public.delete_course($1)', [course.id]), error => error.code === '42501');
  await as(instructor);
  await assert.rejects(one('delete from public.courses where id=$1', [course.id]), error => error.code === '42501');
  await db.exec('reset role');
  await db.query('update public.profiles set approved=false where id=$1', [instructor]);
  await as(instructor);
  await assert.rejects(one('select public.delete_course($1)', [course.id]), error => error.code === '42501');
  await db.exec('reset role');
  await db.query('update public.profiles set approved=true where id=$1', [instructor]);
  await as(instructor);
  await one('select public.delete_course($1)', [course.id]);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select id from public.courses')).rows, [{ id: retained.id }]);
  assert.deepEqual((await db.query('select course_id from public.course_pins')).rows, [{ course_id: retained.id }]);
  for (const table of ['course_modules', 'course_assignments', 'course_enrollments']) assert.equal((await one(`select count(*)::int as count from public.${table}`)).count, 0);
  assert.equal((await one('select count(*)::int as count from public.learning_sessions where id=$1', [assigned.id])).count, 0);
  assert.equal((await one('select count(*)::int as count from public.learning_sessions where id=$1', [personalId])).count, 1);
});

test('courses enforce enrollment, publication, assignment configuration, and private progress in PostgreSQL', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  const course = await one("select * from public.create_course('Physics','approval')");
  assert.match(course.code,/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  const courseId = course.id;
  const saveDraft = (document = doc(), revision = 0) => one('select * from public.save_course_module($1,$2,$3,$4,$5)',[courseId,moduleId,'Energy',document,revision]);
  await saveDraft();
  await t.test('role and account approval are enforced at database boundary', async () => {
    for (const user of [student,pending]) {
      await as(user);
      await assert.rejects(one("select * from public.create_course('Forged','open')"),error => error.code === '42501');
    }
    await as(pending);
    await assert.rejects(one('select * from public.join_course($1)',[course.code]),error => error.code === '42501');
    await as(other);
    assert.equal((await db.query('select * from public.courses')).rows.length,0);
    await assert.rejects(saveDraft(),error => error.code === '42501');
    await assert.rejects(one('select public.course_progress($1)',[courseId]),error => error.code === '42501');
    await as('', 'anon');
    await assert.rejects(one('select * from public.courses'),error => error.code === '42501');
    await assert.rejects(one('select * from public.join_course($1)',[course.code]),error => error.code === '42501');
  });
  await t.test('joining normalizes codes, is idempotent, and hides pending course modules',async () => {
    await as(student);
    await assert.rejects(one("select * from public.join_course('??????')"),error => error.code === 'P0002');
    const joined = await one('select * from public.join_course($1)',[` ${course.code.toLowerCase()} `]);
    assert.equal(joined.status,'pending');
    assert.equal((await one('select * from public.join_course($1)',[course.code])).status,'pending');
    assert.equal((await db.query('select * from public.course_modules')).rows.length,0);
    await assert.rejects(one('select * from public.start_course_module($1)',[moduleId]),error => error.code === '42501');
    await assert.rejects(one("update public.course_enrollments set status='enrolled'"),error => error.code === '42501');
  });
  await t.test('rejection survives rejoining and open enrollment admits only pending requests',async () => {
    await as(instructor);
    await one("select public.decide_course_enrollment($1,$2,'rejected')",[courseId,student]);
    await as(student);
    assert.equal((await one('select * from public.join_course($1)',[course.code])).status,'rejected');
    await as(outsider); await one('select * from public.join_course($1)',[course.code]);
    await as(instructor);
    await one("select * from public.set_course_enrollment($1,'open')",[courseId]);
    const rows = (await db.query('select * from public.course_enrollments order by student_id')).rows;
    assert.deepEqual(rows.map(row => row.status),['rejected','enrolled']);
    await one("select public.decide_course_enrollment($1,$2,'enrolled')",[courseId,student]);
    await one("select * from public.set_course_enrollment($1,'approval')",[courseId]);
    assert.equal((await one('select count(*)::int as count from public.course_enrollments where status=\'enrolled\'')).count,2);
  });
  await t.test('publication validates drafts, strips source data, and locks configuration',async () => {
    await as(instructor);
    await assert.rejects(one('select * from public.publish_course_module($1,99)',[moduleId]),error => error.code === '40001');
    const invalid = doc(); invalid.session.concepts[0].rubric.remember = '';
    await saveDraft(invalid,1);
    await assert.rejects(one('select * from public.publish_course_module($1,2)',[moduleId]),error => error.code === '23514');
    await saveDraft(doc(),2);
    const published = await one('select * from public.publish_course_module($1,3)',[moduleId]);
    assert.ok(published.published_at);
    assert.equal(published.document.session.files,undefined);
    assert.equal(published.document.session.messages,undefined);
    await assert.rejects(saveDraft(doc('Changed'),4),error => error.code === '40001');
    await as(student);
    assert.equal((await db.query('select * from public.course_modules')).rows.length,1);
    await assert.rejects(saveDraft(),error => error.code === '42501');
  });
  let session;
  await t.test('starts resume one assigned session and ordinary writes cannot change the assignment',async () => {
    await as(student);
    session = await one('select * from public.start_course_module($1)',[moduleId]);
    const starts = await Promise.all(Array.from({length:4},() => one('select * from public.start_course_module($1)',[moduleId])));
    assert.ok(starts.every(row => row.id === session.id));
    assert.equal((await one('select count(*)::int as count from public.course_assignments')).count,1);
    assert.equal(session.document.session.started,true);
    const save = (document, id=session.id, revision=1) => one('select * from public.save_learning_session($1,$2,$3,$4)',[id,'Energy',document,revision]);
    const changed = structuredClone(session.document); changed.session.concepts[0].target='remember';
    await assert.rejects(save(changed),error => error.code === '23514');
    const unlinked = structuredClone(session.document); delete unlinked.session.assignment;
    await assert.rejects(save(unlinked),error => error.code === '23514');
    await assert.rejects(save(session.document,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0),error => error.code === '23514');
    await assert.rejects(one('select public.delete_learning_session($1,1)',[session.id]),error => error.code === '23514');
    session.document.session.concepts[0].passed=1;
    session.document.session.concepts[0].messages.push({role:'user',content:'PRIVATE STUDENT CHAT'});
    session = await save(session.document);
    assert.equal(session.revision,2);
    await assert.rejects(save(session.document),error => error.code === '40001');
    const config = (await one('select public.assignment_chat_configuration($1,$2) as config',[session.id,'energy'])).config;
    assert.equal(config.concept.name,'Energy');
    await as(outsider);
    await assert.rejects(one('select public.assignment_chat_configuration($1,$2)',[session.id,'energy']),error => error.code === '42501');
    assert.equal((await db.query('select * from public.learning_sessions')).rows.length,0);
  });
  await t.test('instructors receive progress without conversations, evidence, attachments, or broad profile access',async () => {
    await as(instructor);
    const progress = (await one('select public.course_progress($1) as progress',[courseId])).progress;
    const record = progress.find(value => value.studentId===student);
    assert.equal(record.modules[0].concepts[0].passed,1);
    assert.equal(record.modules[0].concepts[0].target,'understand');
    assert.ok(!JSON.stringify(progress).includes('PRIVATE'));
    assert.deepEqual(Object.keys(record.modules[0].concepts[0]).sort(),['id','name','passed','target']);
    assert.equal((await db.query('select * from public.learning_sessions')).rows.length,0);
    assert.equal((await db.query('select * from public.profiles')).rows.length,1);
    await as(student);
    await assert.rejects(one('select public.course_progress($1)',[courseId]),error => error.code === '42501');
  });
});

test('course code generation retries collisions without changing the existing course', async t => {
  const { db, as, one } = await courseFixture(t);
  // Only this isolated fixture overrides randomness; the production function
  // still uses PostgreSQL's cryptographically random UUID implementation.
  const original = (await one("select pg_get_functiondef('pg_catalog.gen_random_uuid()'::regprocedure) as definition")).definition;
  await db.exec(`create sequence public.test_random_sequence;
    create or replace function pg_catalog.gen_random_uuid() returns uuid language sql volatile as $$
      select case when nextval('public.test_random_sequence') <= 4 then '00000000-0000-4000-8000-000000000000'::uuid else '11111111-1111-4111-8111-111111111111'::uuid end
    $$;`);
  await as(instructor);
  const first = await one("select * from public.create_course('First','open')");
  const second = await one("select * from public.create_course('Second','open')");
  assert.equal(first.code,'AAAAAA');
  assert.equal(second.code,'TTTTTT');
  assert.notEqual(first.id,second.id);
  assert.equal((await one('select count(*)::int as count from public.courses')).count,2);
  await db.exec('reset role'); await db.exec(original);
});

test('course banner migration maps old presets and preserves uploaded and absent banners', async t => {
  const legacy = { meadow: 'mint', dusk: 'lavender', terracotta: 'coral', blueprint: 'sky', sand: 'butter', ink: 'graphite' };
  const imageId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const image = { type: 'image', path: `${imageId}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png` };
  const { db } = await courseFixture(t, async (db, file) => {
    if (file !== '202610190002_course_dashboard_banners.sql') return;
    const owner = '99999999-9999-4999-8999-999999999999';
    await db.query(`insert into auth.users values ($1,'legacy@example.com',now(),'{"provider":"email"}','{}',now())`, [owner]);
    const banners = [...Object.keys(legacy).map(preset => ({ type: 'preset', preset })), { type: 'none' }, image];
    for (const [index, banner] of banners.entries()) {
      await db.query('insert into public.courses(id,instructor_id,name,code,banner) values($1,$2,$3,$4,$5)',
        [banner.type === 'image' ? imageId : crypto.randomUUID(), owner, banner.preset ?? banner.type, `AAAAA${index + 2}`, banner]);
    }
  });
  const rows = (await db.query('select name,banner,appearance_revision from public.courses')).rows;
  for (const [previous, preset] of Object.entries(legacy)) {
    const row = rows.find(row => row.name === previous);
    assert.deepEqual(row.banner, { type: 'preset', preset });
    assert.equal(row.appearance_revision, 2);
  }
  for (const banner of [{ type: 'none' }, image]) {
    const row = rows.find(row => row.name === banner.type);
    assert.deepEqual(row.banner, banner);
    assert.equal(row.appearance_revision, 1);
  }
});

test('course appearance edits enforce ownership, revision checks, and private banner storage', async t => {
  const { db, as, one } = await courseFixture(t);
  await as(instructor);
  let course = await one("select * from public.create_course('Physics','approval')");
  const originalCode = course.code;
  const update = (name, banner, enrollment, revision=course.appearance_revision) => one('select * from public.update_course_details($1,$2,$3,$4,$5)',[course.id,name,banner,enrollment,revision]);
  assert.deepEqual(course.banner,{type:'preset',preset:'mint'});
  course = await update(' Physics 101 ',null,null);
  assert.equal(course.name,'Physics 101'); assert.equal(course.code,originalCode);
  for (const name of ['','   ','x'.repeat(121)]) await assert.rejects(update(name,null,null),error=>error.code==='23514');
  await assert.rejects(update('Stale title',null,null,1),error=>error.code==='40001');
  for (const id of [student,other,pending]) {
    await as(id);
    await assert.rejects(update('Forged',{type:'none'},null),error=>error.code==='42501');
  }
  await as(instructor);
  await assert.rejects(one("update public.courses set name='Forged'"),error=>error.code==='42501');
  for (const banner of [{type:'preset',preset:'invalid'},{type:'url',url:'https://example.com/private'},{type:'image',path:`${course.id}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`}]) await assert.rejects(update(null,banner,null),error=>error.code==='23514');
  for (const preset of ['red','coral','peach','butter','mint','sky','lavender','rose','graphite']) {
    course = await update(null, { type: 'preset', preset }, null);
    assert.deepEqual(course.banner, { type: 'preset', preset });
  }
  await assert.rejects(update(null, { type: 'preset', preset: 'meadow' }, null), error => error.code === '23514');
  const path=`${course.id}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('course-banners',$1)",[path]);
  course=await update(null,{type:'image',path},null);
  assert.equal(course.banner.path,path);
  // A successful save must not lose its image if the network response is lost
  // and the client subsequently attempts to clean up the presumed unused file.
  await db.query("delete from storage.objects where bucket_id='course-banners' and name=$1",[path]);
  assert.equal((await one("select count(*)::int as count from storage.objects where bucket_id='course-banners'")).count,1);
  await db.query("update storage.objects set name='changed' where name=$1",[path]);
  assert.equal((await one("select name from storage.objects where bucket_id='course-banners'")).name,path);
  await as(student);
  assert.equal((await one("select count(*)::int as count from storage.objects where bucket_id='course-banners'")).count,0);
  await one('select * from public.join_course($1)',[course.code]);
  assert.equal((await one("select count(*)::int as count from storage.objects where bucket_id='course-banners'")).count,1);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('course-banners',$1)",[`${course.id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`]),error=>error.code==='42501');
  await as(other);
  assert.equal((await one("select count(*)::int as count from storage.objects where bucket_id='course-banners'")).count,0);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('course-banners',$1)",[`${course.id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`]),error=>error.code==='42501');
  await as(pending);
  assert.equal((await one("select count(*)::int as count from storage.objects where bucket_id='course-banners'")).count,0);
  await as('', 'anon');
  await assert.rejects(update(null,{type:'none'},null),error=>error.code==='42501');
  await as(instructor);
  course=await update(null,{type:'preset',preset:'lavender'},'open');
  assert.equal((await one('select status from public.course_enrollments where course_id=$1',[course.id])).status,'enrolled');
  assert.deepEqual(course.banner,{type:'preset',preset:'lavender'});
  await db.query("delete from storage.objects where bucket_id='course-banners' and name=$1",[path]);
  assert.equal((await one("select count(*)::int as count from storage.objects where bucket_id='course-banners'")).count,0);
  course=await update(null,{type:'none'},null);
  assert.deepEqual(course.banner,{type:'none'});
  const results=await Promise.allSettled([update('First edit',null,null),update('Second edit',null,null)]);
  assert.equal(results.filter(value=>value.status==='fulfilled').length,1);
  assert.equal(results.filter(value=>value.status==='rejected' && value.reason.code==='40001').length,1);
  await db.exec('reset role');
  const bucket=await one("select * from storage.buckets where id='course-banners'");
  assert.equal(bucket.public,false); assert.equal(bucket.file_size_limit,5000000);
  assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
});

test('dashboard banners keep avatar settings, enforce ownership and revisions, and protect referenced uploads', async t => {
  const { db, as, one } = await courseFixture(t);
  const firstImage = `${student}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
  const unusedImage = `${student}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`;
  const foreignImage = `${outsider}/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png`;
  await as(student);
  await db.query('insert into public.user_customizations(user_id,appearance) values($1,$2)', [student, { name: 'Original avatar' }]);
  const save = async (banner, revision) => (await one('select public.save_dashboard_banner($1,$2) as saved', [banner, revision])).saved;
  assert.deepEqual(await save({ type: 'preset', preset: 'dusk' }, 0), { banner: { type: 'preset', preset: 'dusk' }, revision: 1 });
  assert.equal((await one('select appearance from public.user_customizations')).appearance.name, 'Original avatar');
  await db.query('update public.user_customizations set appearance=$1 where user_id=$2', [{ name: 'Updated avatar' }, student]);
  assert.equal((await one('select dashboard_banner from public.user_customizations')).dashboard_banner.preset, 'dusk');
  await assert.rejects(save({ type: 'none' }, 0), error => error.code === '40001');
  for (const banner of [{ type: 'preset', preset: 'invalid' }, { type: 'image', path: foreignImage }, { type: 'image', path: firstImage }, null]) await assert.rejects(save(banner, 1), error => error.code === '23514');
  await assert.rejects(db.query('update public.user_customizations set dashboard_banner=$1', [{ type: 'none' }]), error => error.code === '42501');
  await db.query("insert into storage.objects(bucket_id,name) values('dashboard-banners',$1),('dashboard-banners',$2)", [firstImage, unusedImage]);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('dashboard-banners',$1)", [foreignImage]), error => error.code === '42501');
  await save({ type: 'image', path: firstImage }, 1);
  await db.query("delete from storage.objects where bucket_id='dashboard-banners'");
  assert.deepEqual((await db.query("select name from storage.objects where bucket_id='dashboard-banners'")).rows.map(row => row.name), [firstImage]);
  await as(outsider);
  assert.deepEqual((await db.query("select name from storage.objects where bucket_id='dashboard-banners'")).rows, []);
  assert.deepEqual((await db.query('select user_id from public.user_customizations')).rows, []);
  assert.equal((await save({ type: 'none' }, 0)).revision, 1);
  await as(student);
  await save({ type: 'none' }, 2);
  await db.query("delete from storage.objects where name=$1", [firstImage]);
  assert.equal((await db.query("select * from storage.objects where bucket_id='dashboard-banners'")).rows.length, 0);
  await as(pending);
  await assert.rejects(save({ type: 'none' }, 0), error => error.code === '42501');
  await as('', 'anon');
  await assert.rejects(save({ type: 'none' }, 0), error => error.code === '42501');
});

test('admin course tools search all courses and preview draft and published configuration without write access', async t => {
  const { db, as, one } = await courseFixture(t);
  const admin = '66666666-6666-4666-8666-666666666666';
  await db.query(`insert into auth.users values ($1,'admin@example.com',now(),'{"provider":"email"}','{}',now())`, [admin]);
  await db.query("update public.profiles set approved=true where id=$1", [admin]);
  await db.query("update public.user_roles set role='admin' where user_id=$1", [admin]);
  await as(instructor);
  const course = await one("select * from public.create_course('Physics','approval')");
  const document = doc();
  await one('select * from public.save_course_module($1,$2,$3,$4,0)', [course.id, moduleId, 'Energy draft', document]);
  const publishedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await one('select * from public.save_course_module($1,$2,$3,$4,0)', [course.id, publishedId, 'Energy published', doc()]);
  await one('select * from public.publish_course_module($1,1)', [publishedId]);
  // Drafts can be saved before concepts have been set up.
  await one('select * from public.save_course_module($1,$2,$3,$4,0)', [course.id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '', { version: 1, session: {} }]);
  for (const role of ['anon', 'authenticated']) {
    await as(admin, role);
    await assert.rejects(one('select public.admin_list_courses($1)', [admin]), error => error.code === '42501');
    await assert.rejects(one('select public.admin_view_course($1,$2)', [admin, course.id]), error => error.code === '42501');
  }
  await as('', 'service_role');
  const list = async (page = 1, search = '') => (await one('select public.admin_list_courses($1,$2,$3) as result', [admin, page, search])).result;
  const view = async (actor = admin, id = course.id) => (await one('select public.admin_view_course($1,$2) as result', [actor, id])).result;
  for (const search of ['PHYSICS', course.code.toLowerCase(), `${instructor}@example.com`]) {
    const result = await list(1, search);
    assert.equal(result.total, 1);
    assert.equal(result.courses[0].module_count, 3);
    assert.equal(result.courses[0].instructor.id, instructor);
  }
  assert.equal((await list(1, 'not a course')).total, 0);
  assert.equal((await list(2)).courses.length, 0);
  for (const page of [0, 100001, null]) await assert.rejects(list(page), error => error.code === '22023');
  await assert.rejects(list(1, 'x'.repeat(201)), error => error.code === '22023');
  for (const actor of [student, instructor, pending, null]) {
    await assert.rejects(view(actor), error => error.code === '42501');
    await assert.rejects(one('select public.admin_list_courses($1)', [actor]), error => error.code === '42501');
  }
  await assert.rejects(view(admin, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), error => error.code === 'P0002');
  const detail = await view();
  assert.equal(detail.course.name, 'Physics');
  assert.equal(detail.modules.length, 3);
  const draft = detail.modules.find(module => module.id === moduleId);
  assert.equal(draft.published_at, null);
  assert.equal(draft.learningType, 'quantitative');
  assert.equal(draft.concepts[0].target, 'understand');
  assert.equal(draft.concepts[0].rubric.remember, 'Defines energy.');
  assert.ok(detail.modules.find(module => module.id === publishedId).published_at);
  assert.deepEqual(detail.modules.find(module => !module.title).concepts, []);
  assert.equal(JSON.stringify(detail).includes('private instructor work'), false);
  assert.equal(JSON.stringify(detail).includes('/source/private'), false);
  await db.query(`insert into public.courses(instructor_id, name, code)
    select $1, 'Additional course ' || n, 'TEST' || chr(65 + (n / 8)::int) || chr(65 + (n % 8)::int)
    from generate_series(1, 26) n`, [other]);
  const firstPage = await list();
  const secondPage = await list(2);
  assert.equal(firstPage.total, 27);
  assert.equal(firstPage.courses.length, 25);
  assert.equal(secondPage.courses.length, 2);
  assert.equal(new Set([...firstPage.courses, ...secondPage.courses].map(course => course.id)).size, 27);
  assert.equal((await list(1, `${other}@example.com`)).total, 26);
  await as(admin);
  assert.equal((await db.query('select * from public.courses')).rows.length, 0);
  await assert.rejects(one('select * from public.save_course_module($1,$2,$3,$4,1)', [course.id, moduleId, 'Forged', doc()]), error => error.code === '42501');
  await db.exec('reset role');
  await db.query('update public.profiles set approved=false where id=$1', [admin]);
  await as('', 'service_role');
  await assert.rejects(view(), error => error.code === '42501');
});
