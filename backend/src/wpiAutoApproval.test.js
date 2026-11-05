import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('WPI auto approval trusts Azure identities and preserves consent', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
    create table auth.identities(user_id uuid, provider text);
    create table public.profiles(id uuid primary key, approved boolean default false, consent_required boolean default true);
    insert into auth.users values ('11111111-1111-4111-8111-111111111111', 'linked@wpi.edu', '{"provider":"email"}');
    insert into auth.identities values ('11111111-1111-4111-8111-111111111111', 'azure');
    insert into public.profiles(id) select id from auth.users;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/202611030003_wpi_auto_approval.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await db.query('select approved, consent_required from public.profiles')).rows[0], { approved: true, consent_required: true });
  for (const [email, provider, expected] of [['new@wpi.edu', 'azure', true], ['email@wpi.edu', 'email', false], ['other@example.com', 'azure', false]]) {
    const { rows: [{ id }] } = await db.query(`insert into auth.users values (gen_random_uuid(), $1, jsonb_build_object('provider', $2::text)) returning id`, [email, provider]);
    await db.query('insert into public.profiles(id) values ($1)', [id]);
    assert.deepEqual((await db.query('select approved, consent_required from public.profiles where id = $1', [id])).rows[0], { approved: expected, consent_required: true });
  }
});
