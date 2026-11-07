import test from 'node:test';
import assert from 'node:assert/strict';
import { accessories, characterColors, characterShapes } from '../../frontend/src/characterAppearance.ts';
import { courseFixture } from './courses.test.js';

const student = '11111111-1111-4111-8111-111111111111';
const instructor = '22222222-2222-4222-8222-222222222222';
const topic = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

async function fixture(t, earned = 0) {
  const f = await courseFixture(t);
  for (let n = 0; n < earned; n++) await f.db.query('insert into public.point_awards(student_id,module_id) values($1,$2)', [student, topic(n)]);
  await f.as(student);
  const wallet = async () => (await f.one('select public.cosmetic_wallet() as wallet')).wallet;
  const buy = async item => (await f.one('select public.purchase_cosmetic($1) as wallet', [item])).wallet;
  return { ...f, wallet, buy };
}

test('the frontend shows the prices the database charges', async t => {
  const { db } = await courseFixture(t);
  const charged = Object.fromEntries((await db.query('select id,price from public.cosmetic_items')).rows.map(item => [item.id, item.price]));
  const shown = Object.fromEntries([
    ...characterColors.map(item => [`color:${item.id}`, item.price]),
    ...characterShapes.map(item => [`shape:${item.id}`, item.price]),
    ...accessories.map(item => [`accessory:${item.id}`, item.price]),
  ].filter(([, price]) => price > 0));
  assert.deepEqual(shown, charged);
});

test('purchases spend points once and cannot overdraw', async t => {
  const f = await fixture(t, 1);
  assert.deepEqual(await f.wallet(), { points: 100, owned: [] });
  assert.deepEqual(await f.buy('shape:squircle'), { points: 25, owned: ['shape:squircle'] });
  assert.deepEqual(await f.buy('shape:squircle'), { points: 25, owned: ['shape:squircle'] }, 'a retry is not charged again');
  await assert.rejects(f.buy('color:sky'), error => error.code === '23514');
  await assert.rejects(f.buy('color:red'), error => error.code === '22023');
  assert.deepEqual(await f.buy('accessory:blush'), { points: 0, owned: ['accessory:blush', 'shape:squircle'] });
});

test('admins have unlimited points and a later demotion leaves no debt', async t => {
  const f = await fixture(t);
  await f.db.exec('reset role');
  await f.db.query("update public.user_roles set role='admin' where user_id=$1", [student]);
  await f.as(student);
  assert.equal((await f.wallet()).points, null);
  assert.deepEqual(await f.buy('accessory:monocle'), { points: null, owned: ['accessory:monocle'] });
  await f.db.exec('reset role');
  await f.db.query("update public.user_roles set role='student' where user_id=$1", [student]);
  await f.as(student);
  assert.deepEqual(await f.wallet(), { points: 0, owned: ['accessory:monocle'] });
});

test('admins can give any account points, and only through the server', async t => {
  const f = await fixture(t);
  const grant = (actor, amount) => f.one('select public.admin_grant_points($1,$2,$3) as result', [actor, student, amount]);
  await assert.rejects(grant(student, 500), error => error.code === '42501', 'browsers cannot call the grant');
  await f.db.exec('reset role');
  await assert.rejects(grant(student, 500), error => error.code === '42501', 'the actor must be an admin');
  await f.db.query("update public.user_roles set role='admin' where user_id=$1", [instructor]);
  await assert.rejects(grant(instructor, 0), error => error.code === '23514');
  await assert.rejects(f.one('select public.admin_grant_points($1,$2,5) as result', [instructor, topic(1)]), error => error.code === 'P0002');
  assert.deepEqual((await grant(instructor, 500)).result, { id: student, points: 500 });
  await grant(instructor, 25);
  await f.as(student);
  assert.equal((await f.wallet()).points, 525);
  assert.equal((await f.buy('accessory:monocle')).points, 375);
  await assert.rejects(f.one('select * from public.point_grants'), error => error.code === '42501');
});

test('browser saves cannot equip unowned items', async t => {
  const f = await fixture(t, 1);
  await f.buy('color:sky');
  const save = appearance => f.one('insert into public.user_customizations(user_id,appearance) values($1,$2) on conflict(user_id) do update set appearance=excluded.appearance returning appearance', [student, appearance]);
  const { appearance } = await save({ name: 'Mochi', color: 'sky', shape: 'star', accessories: { glasses: 'monocle', face: null, pin: null } });
  assert.deepEqual(appearance, { name: 'Mochi', color: 'sky', accessories: { face: null, pin: null } });
  assert.equal((await save({ color: 'periwinkle' })).appearance.color, undefined, 'the legacy name for graphite is not free');
});

test('points and purchases stay private', async t => {
  const f = await fixture(t, 1);
  await assert.rejects(f.one('select * from public.point_awards'), error => error.code === '42501');
  await assert.rejects(f.db.query("insert into public.cosmetic_purchases(user_id,item_id,price) values($1,'color:sky',0)", [student]), error => error.code === '42501');
  await f.as(instructor);
  assert.deepEqual(await f.wallet(), { points: 0, owned: [] });
});

test('existing looks and completed topics carry over', async t => {
  const moduleId = topic(9), session = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const f = await courseFixture(t, async (db, file) => {
    if (file !== '202611070002_points.sql') return;
    await db.query(`insert into auth.users values ($1,'legacy@example.com',now(),'{"provider":"email"}','{"role":"instructor"}',now())`, [topic(1)]);
    await db.query('update public.profiles set approved=true where id=$1', [topic(1)]);
    await db.query(`insert into public.user_customizations(user_id,appearance) values($1,'{"color":"periwinkle","shape":"cloud","accessories":{"glasses":"monocle","face":null,"pin":null}}')`, [topic(1)]);
    const owner = (await db.query("insert into auth.users values ($1,'teacher@example.com',now(),'{\"provider\":\"email\"}','{\"role\":\"instructor\"}',now()) returning id", [topic(2)])).rows[0].id;
    const course = (await db.query("insert into public.courses(name,code,instructor_id) values('Physics','ABCDEF',$1) returning id", [owner])).rows[0].id;
    await db.query(`insert into public.course_modules(id,course_id,title) values($1,$2,'Energy')`, [moduleId, course]);
    await db.query(`insert into public.topic_score_topics(student_id,session_id,configuration,session_created_at) values($1,$2,$3,now())`, [topic(1), session, { assignment: { moduleId } }]);
    for (const watermark of [1, 2]) await db.query(`insert into public.topic_report_snapshots(student_id,session_id,watermark,finish_mode,report) values($1,$2,$3,'completed','{}')`, [topic(1), session, watermark]);
  });
  assert.deepEqual((await f.db.query('select item_id,price from public.cosmetic_purchases order by item_id')).rows, [
    { item_id: 'accessory:monocle', price: 0 }, { item_id: 'color:graphite', price: 0 }, { item_id: 'shape:cloud', price: 0 },
  ]);
  assert.deepEqual((await f.db.query('select module_id,points from public.point_awards')).rows, [{ module_id: moduleId, points: 100 }]);
});
