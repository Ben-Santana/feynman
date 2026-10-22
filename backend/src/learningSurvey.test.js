import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createAccountService } from './accounts.js';

const student = '11111111-1111-4111-8111-111111111111';
const admin = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function fixture(t) {
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
  for (const file of (await readdir(folder)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, folder), 'utf8'));
  for (const [id, role] of [[student, 'student'], [admin, 'instructor'], [outsider, 'student']]) {
    await db.query(`insert into auth.users values ($1,$2,now(),'{"provider":"email"}',$3,now())`, [id, `${id}@example.com`, JSON.stringify({ role })]);
    await db.query(`insert into auth.identities values ($1,'email')`, [id]);
    await db.query(`insert into public.signed_consents values ($1,'informed-consent-v1',$2,'Participant',$3,now(),'Consent',$4,$2)`, [id, 'a'.repeat(64), `${id}@example.com`, 'b'.repeat(100)]);
    await db.query('update public.profiles set approved=true where id=$1', [id]);
  }
  await db.query("update public.user_roles set role='admin' where user_id=$1", [admin]);
  const as = async id => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"amr\":[{\"method\":\"password\"}]}',false)", [id]);
  };
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  return { db, as, one };
}
const document = (passed = 0, target = 'understand') => ({ version: 1, session: { started: true, concepts: [{ id: 'energy', name: 'Energy', passed, target }] } });
const answers = () => Object.fromEntries([...Array.from({ length: 19 }, (_, i) => [String(i + 1), i < 15 ? 'Great Gain' : 'Great Help']), ...['concept_change', 'skills_developed', 'most_helpful', '20', '21'].map(id => [id, 'None'])]);

test('survey requires a completed topic, persists after deletion, validates all answers and unlocks the next topic', async t => {
  const { db, as, one } = await fixture(t);
  await as(student);
  const save = (id, doc, revision = 0) => one("select * from public.save_learning_session($1,'Energy',$2,$3)", [id, doc, revision]);
  assert.equal((await one('select public.learning_survey_status() as status')).status, null);
  await assert.rejects(one('select public.submit_learning_survey($1)', [answers()]), /no pending survey/);
  await save(first, document(1));
  await save(second, document(0));
  assert.equal((await one('select public.learning_survey_status() as status')).status, null);
  await save(first, document(2), 1);
  const status = (await one('select public.learning_survey_status() as status')).status;
  assert.equal(status.sessionId, first);
  assert.equal(status.submittedAt, null);
  await assert.rejects(save(second, document(1), 1), error => error.code === '42501');
  await assert.rejects(save('cccccccc-cccc-4ccc-8ccc-cccccccccccc', document()), error => error.code === '42501');
  await one('select public.delete_learning_session($1,2)', [first]);
  assert.equal((await one('select public.learning_survey_status() as status')).status.sessionId, first);
  for (const invalid of [{}, { ...answers(), '1': 'Great Help' }, { ...answers(), '16': 'Great Gain' }, { ...answers(), '20': '  ' }, { ...answers(), extra: 'x' }, { ...answers(), '21': 'a'.repeat(5001) }]) {
    await assert.rejects(one('select public.submit_learning_survey($1)', [invalid]), error => error.code === '23514');
  }
  const valid = { ...answers(), '2': 'Not Applicable', '19': 'Not Applicable' };
  await one('select public.submit_learning_survey($1)', [valid]);
  assert.ok((await one('select public.learning_survey_status() as status')).status.submittedAt);
  await assert.rejects(one('select public.submit_learning_survey($1)', [answers()]), /no pending survey/);
  await save(second, document(2), 1);
  await as(outsider);
  assert.equal((await one('select public.learning_survey_status() as status')).status, null);
  await assert.rejects(one('select public.admin_learning_survey_responses()'), error => error.code === '42501');
  await assert.rejects(db.query('select * from public.learning_surveys'), error => error.code === '42501');
  await as(admin);
  const report = (await one('select public.admin_learning_survey_responses() as data')).data;
  assert.equal(report.responses.length, 1);
  assert.equal(report.pending, 0);
  assert.deepEqual(report.responses[0].answers, valid);
  assert.equal(report.responses[0].studentId, student);
  // Admin learning never creates a student survey.
  await save(first, document(4));
  assert.equal((await one('select public.learning_survey_status() as status')).status, null);
});

test('completion checks every concept against its target and ignores unstarted drafts', async t => {
  const { as, one } = await fixture(t);
  await as(student);
  const doc = document(4);
  doc.session.started = false;
  const save = (revision = 0) => one("select * from public.save_learning_session($1,'Energy',$2,$3)", [first, doc, revision]);
  await save();
  assert.equal((await one('select public.learning_survey_status() as status')).status, null);
  doc.session.started = true;
  doc.session.concepts.push({ id: 'force', name: 'Force', passed: 0, target: 'remember' });
  await save(1);
  assert.equal((await one('select public.learning_survey_status() as status')).status, null);
  doc.session.concepts[1].passed = 1;
  await save(2);
  assert.equal((await one('select public.learning_survey_status() as status')).status.sessionId, first);
});

test('AI access checks pending surveys for students and fails closed when checking fails', async () => {
  let result = { data: { sessionId: first, submittedAt: null }, error: null };
  let calls = 0;
  const service = createAccountService({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public' }, () => ({ rpc: async name => { assert.equal(name, 'learning_survey_status'); calls++; return result; } }));
  const req = { headers: { authorization: 'Bearer test' } };
  await assert.rejects(service.assertLearningSurvey(req, { role: 'student' }), error => error.status === 403);
  result = { data: { submittedAt: '2026-10-22T12:00:00Z' }, error: null };
  await service.assertLearningSurvey(req, { role: 'student' });
  result = { data: null, error: { code: 'PGRST202' } };
  await assert.rejects(service.assertLearningSurvey(req, { role: 'student' }), error => error.status === 503);
  await service.assertLearningSurvey(req, { role: 'admin' });
  assert.equal(calls, 3);
});

test('CSV exports all responses, escapes quoted multiline answers, and prevents spreadsheet formulas', async () => {
  const { surveyCsv, surveyQuestions, gainsScale, helpfulnessScale } = await import('../../frontend/src/learningSurvey.ts');
  assert.equal(surveyQuestions.length, 24);
  assert.deepEqual(gainsScale, ['No Gains', 'A Little Gain', 'Moderate Gain', 'Good Gain', 'Great Gain', 'Not Applicable']);
  assert.deepEqual(helpfulnessScale, ['No Help', 'A Little Help', 'Moderate Help', 'Good Help', 'Great Help', 'Not Applicable']);
  const csv = surveyCsv([{ studentId: student, name: '=SUM(1,2)', email: 'student@example.com', sessionId: first, topicTitle: 'Energy', requiredAt: '2026-10-22', submittedAt: '2026-10-22', version: 'salg-v1', answers: { ...answers(), '20': 'First line\n"Second", line', '21': ' @SUM(A1)' } }]);
  assert.ok(csv.startsWith('\uFEFF"Student ID"'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"First line\n""Second"", line"'));
  assert.ok(csv.includes('"\' @SUM(A1)"'));
  assert.ok(csv.includes('"Great Gain"'));
  assert.ok(csv.includes('"Great Help"'));
});
