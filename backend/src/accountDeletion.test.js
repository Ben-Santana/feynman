import test from 'node:test';
import assert from 'node:assert/strict';
import { courseFixture } from './courses.test.js';
import { AccountError, createAccountService } from './accounts.js';

const student = '11111111-1111-4111-8111-111111111111';
const admin = '22222222-2222-4222-8222-222222222222';
const classmate = '44444444-4444-4444-8444-444444444444';
const session = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const classmateSession = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
const module = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';

async function fixture(t) {
  const f = await courseFixture(t);
  const { db } = f;
  await db.exec('reset role');
  // Matches Supabase, where deleting a user removes its identities.
  await db.exec('alter table auth.identities drop constraint identities_user_id_fkey, add foreign key(user_id) references auth.users(id) on delete cascade');
  await db.query(`update public.user_roles set role='admin' where user_id=$1`, [admin]);
  await db.query(`insert into public.role_audit(actor_id,target_id,old_role,new_role) values($1,$2,'instructor','student')`, [admin, student]);
  for (const [owner, id] of [[student, session], [classmate, classmateSession]]) {
    await db.query(`insert into public.learning_sessions(owner_id,id,title,document) values($1,$2,'Chat','{"version":1,"session":{}}')`, [owner, id]);
    await db.query(`insert into public.topic_score_topics(student_id,session_id,configuration,session_created_at) values($1,$2,'{}',now())`, [owner, id]);
    await db.query(`insert into public.topic_assessment_events(student_id,session_id,event_key,payload) values($1,$2,'event','{}')`, [owner, id]);
    await db.query(`insert into public.topic_report_snapshots(student_id,session_id,watermark,finish_mode,report) values($1,$2,1,'early','{}')`, [owner, id]);
    await db.query('insert into public.research_participants(student_id) values($1)', [owner]);
    await db.query(`insert into public.learning_surveys(student_id,session_id,topic_title) values($1,$2,'Energy')`, [owner, id]);
    await db.query(`insert into public.ai_usage_events(user_id,feature,operation,provider,model,input_tokens,output_tokens,usage_reported) values($1,'chat','chat','anthropic','model',1,1,true)`, [owner]);
    await db.query('insert into public.point_awards(student_id,module_id) values($1,$2)', [owner, module]);
    await db.query('insert into public.point_grants(user_id,actor_id,points) values($1,$2,5)', [owner, admin]);
    await db.query(`insert into public.user_customizations(user_id,appearance) values($1,'{}')`, [owner]);
  }
  const course = (await db.query(`insert into public.courses(instructor_id,name,code) values($1,'Physics','ABCDEF') returning id`, [admin])).rows[0].id;
  const courseModule = (await db.query('insert into public.course_modules(course_id) values($1) returning id', [course])).rows[0].id;
  await db.query(`insert into public.course_enrollments(course_id,student_id,status) values($1,$2,'enrolled'),($1,$3,'enrolled')`, [course, student, classmate]);
  await db.query('insert into public.course_assignments(student_id,module_id,session_id) values($1,$3,$4),($2,$3,$5)', [student, classmate, courseModule, session, classmateSession]);
  await db.query('insert into public.course_stars(user_id,course_id) values($1,$2)', [student, course]);
  await db.query('insert into public.course_pins(user_id,course_id) values($1,$2)', [student, course]);
  await db.query(`insert into storage.objects(bucket_id,name) values('learning-attachments',$1),('dashboard-banners',$2),('learning-attachments',$3)`, [`${student}/${session}/image`, `${student}/banner.png`, `${classmate}/${classmateSession}/image`]);
  return { ...f, course };
}

// Every uuid column in public, so a future table cannot silently keep account data.
async function tablesHolding(db, id) {
  const columns = (await db.query(`select table_name,column_name from information_schema.columns c join information_schema.tables t using(table_schema,table_name) where table_schema='public' and data_type='uuid' and table_type='BASE TABLE'`)).rows;
  const found = new Set();
  for (const { table_name: table, column_name: column } of columns) {
    if ((await db.query(`select 1 from public.${table} where ${column}=$1 limit 1`, [id])).rows.length) found.add(table);
  }
  return [...found].sort();
}

test('deleting an account removes all of its data and keeps only the signed consent', async t => {
  const { db, one } = await fixture(t);
  assert.ok((await tablesHolding(db, student)).length > 10);
  const classmateBefore = await tablesHolding(db, classmate);
  const files = (await one('select public.admin_account_deletion_files($1,$2) as files', [admin, student])).files;
  assert.deepEqual(files.map(file => file.path).sort(), [`${student}/${session}/image`, `${student}/banner.png`].sort());
  assert.deepEqual((await one('select public.admin_delete_account($1,$2) as result', [admin, student])).result, { id: student });
  assert.deepEqual(await tablesHolding(db, student), ['signed_consents']);
  assert.equal((await db.query('select 1 from auth.users where id=$1', [student])).rows.length, 0);
  assert.equal((await db.query('select 1 from public.role_audit where target_id=$1', [student])).rows.length, 0);
  assert.equal((await one('select signature from public.signed_consents where user_id=$1', [student])).signature, 'Test Participant');
  assert.deepEqual(await tablesHolding(db, classmate), classmateBefore);
});

test('account deletion refuses non-admins, self-deletion, and course owners without changing anything', async t => {
  const { db, as, course } = await fixture(t);
  const before = await tablesHolding(db, student);
  const remove = (actor, target) => db.query('select public.admin_delete_account($1,$2)', [actor, target]);
  await assert.rejects(remove(classmate, student), error => error.code === '42501');
  await assert.rejects(remove(admin, admin), error => error.code === 'FA001');
  await assert.rejects(remove(admin, '99999999-9999-4999-8999-999999999999'), error => error.code === 'P0002');
  await db.query('update public.courses set instructor_id=$1 where id=$2', [student, course]);
  await assert.rejects(remove(admin, student), error => error.code === 'FA002');
  await assert.rejects(db.query('select public.admin_account_deletion_files($1,$2)', [admin, student]), error => error.code === 'FA002');
  assert.deepEqual(await tablesHolding(db, student), [...new Set([...before, 'courses'])].sort());
  await as(admin);
  await assert.rejects(remove(admin, classmate), error => error.code === '42501');
  await assert.rejects(db.query('select public.admin_account_deletion_files($1,$2)', [admin, classmate]), error => error.code === '42501');
});

test('chats stay undeletable outside account deletion', async t => {
  const { db } = await fixture(t);
  const removeChat = () => db.query('delete from public.learning_sessions where id=$1', [classmateSession]);
  await assert.rejects(removeChat(), error => error.code === '42501');
  await db.query('select public.admin_delete_account($1,$2)', [admin, student]);
  await assert.rejects(removeChat(), error => error.code === '42501');
  await assert.rejects(db.exec('truncate public.learning_sessions cascade'), error => error.code === '42501');
  await db.exec('begin');
  await db.query(`select set_config('feynman.deleting_account',$1,true)`, [student]);
  await assert.rejects(removeChat(), error => error.code === '42501');
  await db.exec('rollback');
});

function service({ rpcErrors = {}, removeError = null } = {}) {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push(['rpc', name, args]);
      if (rpcErrors[name]) return { data: null, error: rpcErrors[name] };
      return { data: name === 'admin_account_deletion_files' ? [{ bucket: 'learning-attachments', path: 'a' }, { bucket: 'dashboard-banners', path: 'b' }] : { id: student }, error: null };
    },
    storage: { from: bucket => ({ remove: async paths => { calls.push(['remove', bucket, paths]); return { error: removeError }; } }) },
  };
  return { calls, accounts: createAccountService({ SUPABASE_URL: 'https://example.test', SUPABASE_SECRET_KEY: 'private-key', SUPABASE_PUBLISHABLE_KEY: 'public-key' }, () => client) };
}

test('the account service removes files before deleting data and stays retryable', async () => {
  const actor = { id: admin, role: 'admin' };
  const ok = service();
  assert.deepEqual(await ok.accounts.deleteAccount(actor, student), { id: student });
  assert.deepEqual(ok.calls.map(call => call.slice(0, 2)), [['rpc', 'admin_account_deletion_files'], ['remove', 'learning-attachments'], ['remove', 'dashboard-banners'], ['rpc', 'admin_delete_account']]);
  const failed = service({ removeError: { message: 'down' } });
  await assert.rejects(failed.accounts.deleteAccount(actor, student), error => error instanceof AccountError && error.status === 503);
  assert.equal(failed.calls.some(call => call[1] === 'admin_delete_account'), false);
  const owner = service({ rpcErrors: { admin_account_deletion_files: { code: 'FA002' } } });
  await assert.rejects(owner.accounts.deleteAccount(actor, student), error => error.status === 409 && /courses/.test(error.message));
  assert.equal(owner.calls.some(call => call[0] === 'remove'), false);
  await assert.rejects(ok.accounts.deleteAccount({ ...actor, role: 'student' }, student), error => error.status === 403);
  await assert.rejects(ok.accounts.deleteAccount(actor, 'invalid'), error => error.status === 400);
});
