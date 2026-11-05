import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('chat retention blocks direct deletion, cascades, truncation, and legacy client RPCs', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create table public.accounts(id int primary key);
    create table public.learning_sessions(id uuid primary key, owner_id int references accounts(id) on delete cascade, document jsonb);
    create function public.delete_learning_session(uuid,bigint) returns void language sql security definer as $$ delete from public.learning_sessions where id=$1 $$;
    insert into accounts values(1);
    insert into learning_sessions values('11111111-1111-4111-8111-111111111111',1,'{"messages":["Keep this chat"]}');
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/202611030002_preserve_chats.sql', import.meta.url), 'utf8'));
  for (const query of [
    'delete from public.learning_sessions',
    'delete from public.accounts where id=1',
    'truncate public.learning_sessions',
    "select public.delete_learning_session('11111111-1111-4111-8111-111111111111',1)",
  ]) await assert.rejects(db.exec(query), /Chats are retained/);
  await db.exec('set role authenticated');
  await assert.rejects(db.exec("select public.delete_learning_session('11111111-1111-4111-8111-111111111111',1)"), /permission denied/);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select document from learning_sessions')).rows, [{ document: { messages: ['Keep this chat'] } }]);
  await db.exec("update learning_sessions set document=document || '{\"saved\":true}'::jsonb");
  assert.equal((await db.query('select document from learning_sessions')).rows[0].document.saved, true);
});
