import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const student = '11111111-1111-4111-8111-111111111111';
const instructor = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// Execute the actual migration in PostgreSQL's WASM engine. Only the platform's
// preexisting auth/storage schemas and roles are represented by this fixture.
test('account migration enforces database and storage permissions in PostgreSQL', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, last_sign_in_at timestamptz);
    create table auth.identities (user_id uuid references auth.users(id), provider text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text unique);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(regexp_replace(name, '/[^/]+$', ''), '/') $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role, supabase_auth_admin;
    grant select, insert, update, delete on storage.objects to authenticated;
  `);
  const migration = await readFile(new URL('../../supabase/migrations/202610130001_accounts.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  for (const [id, name] of [[student, 'Student'], [instructor, 'Instructor'], [admin, 'Admin']]) {
    await db.query(`insert into auth.users values ($1, $2, now(), '{"provider":"azure"}', $3, now())`, [id, `${name.toLowerCase()}@wpi.edu`, JSON.stringify({ full_name: name, role: 'admin' })]);
    await db.query(`insert into auth.identities values ($1, 'azure')`, [id]);
  }
  await db.exec(await readFile(new URL('../../supabase/migrations/202610130002_email_auth.sql', import.meta.url), 'utf8'));
  await db.query(`update public.user_roles set role = 'instructor' where user_id = $1`, [instructor]);
  await db.query(`update public.user_roles set role = 'admin' where user_id = $1`, [admin]);
  async function as(id, role = 'authenticated', method = 'oauth') {
    await db.exec(`reset role; set role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id || '']);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ amr: [{ method }] })]);
  }
  const document = JSON.stringify({ version: 1, session: { concepts: [], files: [] } });
  async function save(id, revision, title = 'Learning') {
    return db.query(`select * from public.save_learning_session($1, $2, $3, $4)`, [id, title, document, revision]);
  }
  await as(student); await save(first, 0);
  await as(instructor); await save(second, 0);

  await t.test('new accounts ignore user-editable role metadata', async () => {
    await as(student);
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'student');
    assert.equal((await db.query('select count(*)::int as count from public.profiles')).rows[0].count, 1);
  });
  await t.test('students, instructors, and admins can only read their own conversations', async () => {
    for (const [id, count] of [[student, 1], [instructor, 1], [admin, 0]]) {
      await as(id);
      assert.equal((await db.query('select count(*)::int as count from public.learning_sessions')).rows[0].count, count);
    }
  });
  await t.test('direct writes cannot forge roles, email, session ownership, or revision', async () => {
    await as(student);
    await assert.rejects(db.query(`update public.user_roles set role = 'admin' where user_id = $1`, [student]), error => error.code === '42501');
    await assert.rejects(db.query(`update public.profiles set email = 'fake@wpi.edu' where id = $1`, [student]), error => error.code === '42501');
    await assert.rejects(db.query(`update public.learning_sessions set revision = 99`), error => error.code === '42501');
    await assert.rejects(db.query(`insert into public.learning_sessions(owner_id,id,title,document) values ($1,$2,'Fake',$3)`, [instructor, first, document]), error => error.code === '42501');
    await db.query(`update public.profiles set display_name = 'Updated' where id = $1`, [student]);
    assert.equal((await db.query('select display_name from public.profiles')).rows[0].display_name, 'Updated');
  });
  await t.test('session writes compare revisions atomically and cannot modify another owner', async () => {
    await as(student);
    assert.equal((await save(first, 1, 'Updated')).rows[0].revision, 2);
    await assert.rejects(save(first, 1), error => error.code === '40001');
    await assert.rejects(save(second, 1), error => error.code === '40001');
    await assert.rejects(db.query('select public.delete_learning_session($1,1)', [first]), error => error.code === '40001');
    await assert.rejects(db.query('select public.delete_learning_session($1,1)', [second]), error => error.code === '40001');
    await assert.rejects(db.query(`select public.save_learning_session(gen_random_uuid(),'Invalid','{}',0)`), error => error.code === '23514');
  });
  await t.test('customization supports owner upserts and denies another user', async () => {
    await as(student);
    await db.query(`insert into public.user_customizations(user_id,appearance) values ($1,'{"name":"Mochi"}') on conflict(user_id) do update set user_id=excluded.user_id,appearance=excluded.appearance`, [student]);
    await db.query(`insert into public.user_customizations(user_id,appearance) values ($1,'{"name":"Feynman"}') on conflict(user_id) do update set user_id=excluded.user_id,appearance=excluded.appearance`, [student]);
    await assert.rejects(db.query(`insert into public.user_customizations(user_id,appearance) values ($1,'{}')`, [instructor]), error => error.code === '42501');
    await as(instructor); assert.equal((await db.query('select * from public.user_customizations')).rows.length, 0);
  });
  await t.test('private file objects enforce account ownership without an admin exception', async () => {
    await as(student);
    await db.query(`insert into storage.objects(bucket_id,name) values ('learning-attachments',$1)`, [`${student}/${first}/image`]);
    await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values ('learning-attachments',$1)`, [`${instructor}/${second}/forged`]), error => error.code === '42501');
    for (const id of [instructor, admin]) { await as(id); assert.equal((await db.query('select * from storage.objects')).rows.length, 0); }
    await as(student); assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await db.query('delete from storage.objects');
  });
  await t.test('anonymous callers cannot read data or call privileged RPCs', async () => {
    await as('', 'anon');
    await assert.rejects(db.query('select * from public.profiles'), error => error.code === '42501');
    await assert.rejects(save(first, 0), error => error.code === '42501');
    await as(student);
    await assert.rejects(db.query('select public.admin_set_role($1,$2,\'admin\')', [admin, student]), error => error.code === '42501');
    await assert.rejects(db.query('select public.admin_list_users($1)', [admin]), error => error.code === '42501');
  });
  await t.test('admin changes are audited and the final admin cannot be demoted', async () => {
    await as('', 'service_role');
    await assert.rejects(db.query(`select public.admin_set_role($1,$1,'student')`, [admin]), error => error.code === '23514');
    await assert.rejects(db.query(`select public.admin_set_role($1,$2,'admin')`, [instructor, student]), error => error.code === '42501');
    await db.query(`select public.admin_set_role($1,$2,'admin')`, [admin, student]);
    await db.query(`select public.admin_set_role($1,$1,'instructor')`, [admin]);
    const audit = (await db.query('select * from public.role_audit order by id')).rows;
    assert.equal(audit.length, 2); assert.equal(audit[0].actor_id, admin); assert.equal(audit[0].old_role, 'student');
    await assert.rejects(db.query(`select public.admin_set_role($1,$1,'student')`, [student]), error => error.code === '23514');
    const listed = (await db.query(`select public.admin_list_users($1,1,'updated') as result`, [student])).rows[0].result;
    assert.equal(listed.total, 1); assert.equal(listed.users[0].id, student);
  });
  await t.test('signup hook and profile trigger reject alternate providers and domains', async () => {
    await db.exec('reset role');
    for (const user of [{ email: 'fake@other.edu', app_metadata: { provider: 'azure' } }, { email: 'fake@wpi.edu', app_metadata: { provider: 'google' } }]) {
      const response = (await db.query('select public.before_wpi_user_created($1) as result', [JSON.stringify({ user })])).rows[0].result;
      assert.equal(response.error.http_code, 403);
      await assert.rejects(db.query(`insert into auth.users(id,email,raw_app_meta_data) values (gen_random_uuid(),$1,$2)`, [user.email, JSON.stringify(user.app_metadata)]), error => error.code === '23514');
    }
  });
  await t.test('temporary accounts require confirmation and cannot change the auth mode', async () => {
    await db.exec('reset role');
    const id = '44444444-4444-4444-8444-444444444444';
    const unconfirmed = '55555555-5555-4555-8555-555555555555';
    const hook = (await db.query('select public.before_wpi_user_created($1) as result', [JSON.stringify({ user: { email: 'temporary@wpi.edu', app_metadata: { provider: 'email' } } })])).rows[0].result;
    assert.deepEqual(hook, {});
    for (const [userId, confirmed] of [[id, true], [unconfirmed, false]]) {
      await db.query(`insert into auth.users values ($1,$2,case when $3 then now() else null end,'{"provider":"email"}','{"role":"admin"}',now())`, [userId, `${userId}@wpi.edu`, confirmed]);
      await db.query(`insert into auth.identities values ($1,'email')`, [userId]);
    }
    await as('', 'anon');
    assert.equal((await db.query('select public.get_account_auth_mode() as mode')).rows[0].mode, 'email');
    await assert.rejects(db.query(`update public.account_auth_settings set mode = 'wpi'`), error => error.code === '42501');
    await as(unconfirmed, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
    await assert.rejects(save(first, 0), error => error.code === '42501');
    await as(id, 'authenticated', 'password');
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'student');
    await assert.rejects(db.query(`update public.account_auth_settings set mode = 'wpi'`), error => error.code === '42501');
    await save(first, 0, 'Temporary learning');
    await db.query(`update public.profiles set display_name = 'Keep my name' where id = $1`, [id]);
    await db.query(`insert into public.user_customizations(user_id,appearance) values ($1,'{"name":"Keep my character"}')`, [id]);
    await db.query(`insert into storage.objects(bucket_id,name) values ('learning-attachments',$1)`, [`${id}/${first}/image`]);
  });
  await t.test('SSO cutover revokes password sessions and linking preserves the existing account data', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    await as('', 'service_role');
    await db.query(`update public.account_auth_settings set mode = 'wpi'`);
    await as(id, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    assert.equal((await db.query('select * from public.learning_sessions')).rows.length, 0);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    assert.equal((await db.query('select * from public.user_customizations')).rows.length, 0);
    await assert.rejects(save(first, 1), error => error.code === '42501');
    await db.exec('reset role');
    const signup = { user: { email: 'new@wpi.edu', app_metadata: { provider: 'email' } } };
    assert.equal((await db.query('select public.before_wpi_user_created($1) as result', [JSON.stringify(signup)])).rows[0].result.error.http_code, 403);
    await assert.rejects(db.query(`insert into auth.users(id,email,raw_app_meta_data) values (gen_random_uuid(),'new@wpi.edu','{"provider":"email"}')`), error => error.code === '23514');
    // A confirmed matching Azure identity is attached to the existing UUID.
    await db.query(`insert into auth.identities values ($1,'azure')`, [id]);
    await db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [id]);
    await as(id, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    await as(id, 'authenticated', 'oauth');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select display_name from public.profiles')).rows[0].display_name, 'Keep my name');
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'student');
    assert.equal((await db.query('select title from public.learning_sessions')).rows[0].title, 'Temporary learning');
    assert.equal((await db.query('select appearance from public.user_customizations')).rows[0].appearance.name, 'Keep my character');
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await save(first, 1, 'Learning after SSO');
    // An unrelated OAuth identity must never grant access via the Azure link.
    await db.exec('reset role');
    await db.query(`insert into auth.identities values ($1,'google')`, [id]);
    await as(id, 'authenticated', 'oauth');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
  });

  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../supabase/migrations/202610160001_invite_signup.sql', import.meta.url), 'utf8'));
  await db.query(`update public.account_auth_settings set mode = 'email'`);
  const invited = '66666666-6666-4666-8666-666666666666';
  const pending = '77777777-7777-4777-8777-777777777777';
  const code = 'test-invite-with-entropy';
  async function hook(email, invite_code = code, provider = 'email') {
    return (await db.query('select public.before_wpi_user_created($1) as result', [JSON.stringify({ user: { email, app_metadata: { provider }, user_metadata: { invite_code } } })])).rows[0].result;
  }
  async function signup(id, email, invite_code, confirmed = true, provider = 'email') {
    return db.query(`insert into auth.users values ($1,$2,case when $3 then now() else null end,$4,$5,now())`, [id, email, confirmed, JSON.stringify({ provider }), JSON.stringify({ invite_code, role: 'admin' })]);
  }
  await t.test('invites are enforced for any email, including direct signup with the hook disabled', async () => {
    assert.equal((await hook('learner@example.com')).error.http_code, 403);
    await assert.rejects(signup(invited, 'learner@example.com', code), error => error.code === '23514');
    await db.query(`insert into public.signup_invites(code_hash) values (encode(sha256(convert_to($1, 'UTF8')), 'hex'))`, [code]);
    for (const invalid of [null, '', 'wrong', 'a'.repeat(129)]) {
      assert.equal((await hook('learner@example.com', invalid)).error.http_code, 403);
      await assert.rejects(signup(invited, 'learner@example.com', invalid), error => error.code === '23514');
    }
    for (const email of ['invalid', 'user@@example.com', 'user@ example.com']) assert.equal((await hook(email)).error.http_code, 403);
    assert.equal((await hook('learner@example.com', code, 'google')).error.http_code, 403);
    assert.equal((await hook('learner@example.com', code, 'azure')).error.http_code, 403);
    await as('', 'supabase_auth_admin');
    assert.deepEqual(await hook('learner@example.com'), {});
    await db.exec('reset role');
    await signup(invited, 'learner@example.com', ` ${code} `);
    await signup(pending, 'pending@other.org', code, false);
    for (const id of [invited, pending]) {
      await db.query(`insert into auth.identities values ($1, 'email')`, [id]);
      const metadata = (await db.query('select raw_user_meta_data from auth.users where id = $1', [id])).rows[0].raw_user_meta_data;
      assert.equal(Object.hasOwn(metadata, 'invite_code'), false);
    }
    await as(invited, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'student');
    await save(first, 0, 'Invited learning');
    await as(pending, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    assert.equal((await db.query('select * from public.learning_sessions')).rows.length, 0);
  });
  await t.test('invite hashes and validation cannot be read, changed, or probed by clients', async () => {
    for (const role of ['anon', 'authenticated']) {
      await as(invited, role);
      await assert.rejects(db.query('select * from public.signup_invites'), error => error.code === '42501');
      await assert.rejects(db.query('update public.signup_invites set revoked = false'), error => error.code === '42501');
      await assert.rejects(db.query(`select public.signup_allowed('learner@example.com','email',$1)`, [code]), error => error.code === '42501');
      await assert.rejects(hook('learner@example.com'), error => error.code === '42501');
    }
  });
  await t.test('revoked and expired invites prevent signup without locking out existing accounts', async () => {
    await db.exec('reset role');
    await db.query(`update public.signup_invites set revoked = true`);
    assert.equal((await hook('new@example.com')).error.http_code, 403);
    await assert.rejects(signup('88888888-8888-4888-8888-888888888888', 'new@example.com', code), error => error.code === '23514');
    await db.query(`update public.signup_invites set revoked = false, expires_at = now() - interval '1 second'`);
    assert.equal((await hook('new@example.com')).error.http_code, 403);
    await assert.rejects(signup('88888888-8888-4888-8888-888888888888', 'new@example.com', code), error => error.code === '23514');
    await db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [invited]);
    await as(invited, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select title from public.learning_sessions')).rows[0].title, 'Invited learning');
  });
  await t.test('WPI SSO cutover still requires WPI email and OAuth and retains existing WPI data', async () => {
    await db.exec('reset role');
    await db.query(`update public.account_auth_settings set mode = 'wpi'`);
    assert.equal((await hook('new@wpi.edu')).error.http_code, 403);
    assert.deepEqual(await hook('new@wpi.edu', null, 'azure'), {});
    assert.equal((await hook('new@example.com', null, 'azure')).error.http_code, 403);
    await as(invited, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    await db.exec('reset role');
    await db.query(`insert into auth.identities values ($1, 'azure')`, [invited]);
    await as(invited, 'authenticated', 'oauth');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    await as(instructor, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    await as(instructor, 'authenticated', 'oauth');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select title from public.learning_sessions')).rows[0].title, 'Learning');
    await db.exec('reset role');
    await signup('99999999-9999-4999-8999-999999999999', 'new@wpi.edu', null, true, 'azure');
    await assert.rejects(signup('88888888-8888-4888-8888-888888888888', 'new@wpi.edu', code), error => error.code === '23514');
  });

  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../supabase/migrations/202610160002_open_email_signup.sql', import.meta.url), 'utf8'));
  await db.query(`update public.account_auth_settings set mode = 'email'`);
  const openAccount = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  await t.test('open signup accepts any email with no invite or email confirmation and retains private data', async () => {
    await as('', 'supabase_auth_admin');
    assert.deepEqual(await hook('open@example.net', null), {});
    await db.exec('reset role');
    await signup(openAccount, 'open@example.net', undefined, false);
    await db.query(`insert into auth.identities values ($1, 'email')`, [openAccount]);
    await as(openAccount, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'student');
    await save(first, 0, 'Open signup learning');
    assert.equal((await db.query('select title from public.learning_sessions')).rows[0].title, 'Open signup learning');
    assert.equal((await db.query('select count(*)::int as count from public.learning_sessions')).rows[0].count, 1);
    await as(pending, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select * from public.learning_sessions')).rows.length, 0);
  });
  await t.test('open signup still rejects invalid email and unsupported providers without the hook', async () => {
    await db.exec('reset role');
    for (const [email, provider] of [['invalid', 'email'], ['user@@example.net', 'email'], ['new@example.net', 'google'], ['new@example.net', 'azure']]) {
      assert.equal((await hook(email, null, provider)).error.http_code, 403);
      await assert.rejects(signup('dddddddd-dddd-4ddd-8ddd-dddddddddddd', email, undefined, false, provider), error => error.code === '23514');
    }
    await as(openAccount);
    await assert.rejects(db.query(`update public.account_auth_settings set mode = 'wpi'`), error => error.code === '42501');
    await assert.rejects(db.query('select * from public.signup_invites'), error => error.code === '42501');
  });
  await t.test('WPI mode still requires verified WPI email and an OAuth session after open signup', async () => {
    await db.exec('reset role');
    await db.query(`update public.account_auth_settings set mode = 'wpi'`);
    assert.equal((await hook('open@example.net', null)).error.http_code, 403);
    assert.deepEqual(await hook('new@wpi.edu', null, 'azure'), {});
    await as(openAccount, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    await as(instructor, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    await as(instructor, 'authenticated', 'oauth');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    await db.exec('reset role');
    await db.query('update auth.users set email_confirmed_at = null where id = $1', [instructor]);
    await as(instructor, 'authenticated', 'oauth');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
  });

  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../supabase/migrations/202610160003_account_approval.sql', import.meta.url), 'utf8'));
  await db.query(`update public.account_auth_settings set mode = 'email'`);
  const awaiting = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  await t.test('approval migration retains existing access and new signups cannot self-approve', async () => {
    await as(openAccount, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    await db.exec('reset role');
    await signup(awaiting, 'awaiting@example.com', undefined, false);
    await db.query(`insert into auth.identities values ($1, 'email')`, [awaiting]);
    // Signup metadata and subsequent sign-ins never grant approval.
    await db.query(`update auth.users set raw_user_meta_data = '{"approved":true}', last_sign_in_at = now() where id = $1`, [awaiting]);
    await as(awaiting, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_signed_in() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    assert.deepEqual((await db.query('select id, approved from public.profiles')).rows, [{ id: awaiting, approved: false }]);
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'student');
    await assert.rejects(db.query('update public.profiles set approved = true'), error => error.code === '42501');
    await db.query(`update public.profiles set display_name = 'Bypass'`);
    assert.notEqual((await db.query('select display_name from public.profiles')).rows[0].display_name, 'Bypass');
    assert.equal((await db.query('select * from public.learning_sessions')).rows.length, 0);
    await assert.rejects(save(first, 0), error => error.code === '42501');
    await assert.rejects(db.query('select public.delete_learning_session($1, 1)', [first]), error => error.code === '42501');
    await assert.rejects(db.query(`insert into public.user_customizations(user_id,appearance) values ($1,'{}')`, [awaiting]), error => error.code === '42501');
    await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values ('learning-attachments',$1)`, [`${awaiting}/${first}/image`]), error => error.code === '42501');
    await assert.rejects(db.query('select public.admin_approve_account($1, $1)', [awaiting]), error => error.code === '42501');
  });
  await t.test('only an approved admin can approve; approval unlocks learning without changing roles', async () => {
    await as('', 'service_role');
    await assert.rejects(db.query('select public.admin_approve_account($1,$2)', [instructor, awaiting]), error => error.code === '42501');
    const listed = (await db.query(`select public.admin_list_users($1,1,'awaiting') as result`, [student])).rows[0].result;
    assert.equal(listed.users[0].approved, false);
    assert.deepEqual((await db.query('select public.admin_approve_account($1,$2) as result', [student, awaiting])).rows[0].result, { id: awaiting, approved: true });
    await as(awaiting, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'student');
    await save(first, 0, 'Approved learning');
    assert.equal((await db.query('select title from public.learning_sessions')).rows[0].title, 'Approved learning');
  });

  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../supabase/migrations/202610160004_signup_roles.sql', import.meta.url), 'utf8'));
  await db.query(`update public.account_auth_settings set mode = 'email'`);
  await t.test('signup saves instructor or student once and never grants admin or approval', async () => {
    for (const [index, requested, expected] of [[1, 'instructor', 'instructor'], [2, 'student', 'student'], [3, 'admin', 'student'], [4, null, 'student']]) {
      const id = `12345678-1234-4234-8234-12345678900${index}`;
      await db.query(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values ($1,$2,'{"provider":"email"}',$3)`, [id, `role${index}@example.com`, JSON.stringify({ role: requested, approved: true })]);
      assert.equal((await db.query('select role from public.user_roles where user_id = $1', [id])).rows[0].role, expected);
      assert.equal((await db.query('select approved from public.profiles where id = $1', [id])).rows[0].approved, false);
      await db.query(`update auth.users set raw_user_meta_data = '{"role":"admin"}', last_sign_in_at = now() where id = $1`, [id]);
      assert.equal((await db.query('select role from public.user_roles where user_id = $1', [id])).rows[0].role, expected);
    }
    assert.equal((await db.query('select role from public.user_roles where user_id = $1', [instructor])).rows[0].role, 'instructor');
  });
  await db.exec(await readFile(new URL('../../supabase/migrations/202610160005_pending_account_roles.sql', import.meta.url), 'utf8'));
  await t.test('pending accounts can change only their own public role before approval', async () => {
    const id = '12345678-1234-4234-8234-123456789001';
    await db.query(`insert into auth.identities values ($1, 'email')`, [id]);
    await as(id, 'authenticated', 'password');
    for (const role of ['student', 'instructor']) {
      assert.equal((await db.query('select public.set_pending_account_role($1) as role', [role])).rows[0].role, role);
      assert.equal((await db.query('select role from public.user_roles')).rows[0].role, role);
    }
    for (const role of ['admin', null]) await assert.rejects(db.query('select public.set_pending_account_role($1)', [role]), error => error.code === '23514');
    assert.equal((await db.query('select approved from public.profiles')).rows[0].approved, false);
    await assert.rejects(db.query(`update public.user_roles set role = 'student'`), error => error.code === '42501');
    await as(id, 'anon');
    await assert.rejects(db.query(`select public.set_pending_account_role('student')`), error => error.code === '42501');
    await as('', 'service_role');
    assert.equal((await db.query('select role from public.user_roles where user_id = $1', [instructor])).rows[0].role, 'instructor');
    await db.query('select public.admin_approve_account($1, $2)', [student, id]);
    await as(id, 'authenticated', 'password');
    await assert.rejects(db.query(`select public.set_pending_account_role('student')`), error => error.code === '42501');
    assert.equal((await db.query('select role from public.user_roles')).rows[0].role, 'instructor');
  });

  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../supabase/migrations/202610190006_consent.sql', import.meta.url), 'utf8'));
  await t.test('consent blocks new approved users, cannot be forged, and remains private and immutable', async () => {
    const id = 'abcdefab-1234-4234-8234-123456789001';
    await as(openAccount, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    await db.exec('reset role');
    await signup(id, 'consent@example.com', undefined, false);
    await db.query(`insert into auth.identities values ($1, 'email')`, [id]);
    await db.query('update public.profiles set approved = true where id = $1', [id]);
    await as(id, 'authenticated', 'password');
    assert.equal((await db.query('select public.account_signed_in() as allowed')).rows[0].allowed, true);
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, false);
    assert.equal((await db.query('select public.has_signed_consent() as signed')).rows[0].signed, false);
    await assert.rejects(db.query('update public.profiles set consent_required = false'), error => error.code === '42501');
    await assert.rejects(db.query('select * from public.signed_consents'), error => error.code === '42501');
    await assert.rejects(db.query(`insert into public.signed_consents(user_id) values ($1)`, [id]), error => error.code === '42501');
    await as('', 'service_role');
    await db.query(`insert into public.signed_consents values ($1,'informed-consent-v1',$2,'Participant','consent@example.com',now(),'I agree',$3,$2)`, [id, 'a'.repeat(64), 'b'.repeat(100)]);
    await assert.rejects(db.query(`update public.signed_consents set signature = 'Changed'`), error => error.code === '42501');
    await assert.rejects(db.query('delete from public.signed_consents'), error => error.code === '42501');
    await as(id, 'authenticated', 'password');
    assert.equal((await db.query('select public.has_signed_consent() as signed')).rows[0].signed, true);
    assert.equal((await db.query('select public.account_allowed() as allowed')).rows[0].allowed, true);
    await as(openAccount, 'authenticated', 'password');
    assert.equal((await db.query('select public.has_signed_consent() as signed')).rows[0].signed, false);
    await as(id, 'anon');
    await assert.rejects(db.query('select public.has_signed_consent()'), error => error.code === '42501');
  });

});
