import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { courseFixture } from './courses.test.js';

const directory = new URL('../../supabase/migrations/', import.meta.url);
const fixName = '202611070001_conflict_error_code.sql';
const raises40001 = /errcode\s*=\s*'40001'/i;

test('conflict migration replaces 40001 and preserves function settings', async () => {
  const db = new PGlite();
  await db.exec(`
    create role app_user;
    create function public.spaced() returns void language plpgsql security definer set search_path = '' as $$
    begin raise exception 'Changed' using errcode = '40001'; end; $$;
    create function public.compact(value integer) returns integer language plpgsql as $$
    begin if value = 0 then raise exception 'Changed' using errcode='40001'; end if; return value; end; $$;
    create function public.unrelated() returns void language plpgsql as $$
    begin raise exception 'Denied' using errcode = '42501'; end; $$;
    grant execute on function public.spaced() to app_user;
  `);
  await db.exec(await readFile(new URL(fixName, directory), 'utf8'));

  await assert.rejects(db.query('select public.spaced()'), error => error.code === 'PT409' && error.message === 'Changed');
  await assert.rejects(db.query('select public.compact(0)'), error => error.code === 'PT409');
  await assert.rejects(db.query('select public.unrelated()'), error => error.code === '42501');
  const { rows: [settings] } = await db.query(`
    select prosecdef, proconfig, has_function_privilege('app_user', oid, 'execute') as granted
    from pg_proc where proname = 'spaced'`);
  assert.deepEqual(settings, { prosecdef: true, proconfig: ['search_path=""'], granted: true });
  await db.close();
});

test('no function raises 40001 after the full migration chain', async t => {
  const { db } = await courseFixture(t);
  const { rows } = await db.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~ '40001'`);
  assert.deepEqual(rows, []);
});

test('migrations after the conflict fix never raise 40001', async () => {
  const later = (await readdir(directory)).filter(name => name.endsWith('.sql') && name > fixName);
  for (const name of later) assert.doesNotMatch(await readFile(new URL(name, directory), 'utf8'), raises40001, name);
});
