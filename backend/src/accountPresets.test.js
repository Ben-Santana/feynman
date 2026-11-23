import test from 'node:test';
import assert from 'node:assert/strict';
import { courseFixture } from './courses.test.js';

const admin = '99999999-9999-4999-8999-999999999999';
const ids = ['a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'a3333333-3333-4333-8333-333333333333', 'a4444444-4444-4444-8444-444444444444', 'a5555555-5555-4555-8555-555555555555'];

test('an admin can set up an account before its owner first signs in', async t => {
  const { db } = await courseFixture(t);
  await db.exec('reset role');
  const signUp = async (id, email, provider) => { await db.query(`insert into auth.users values ($1,$2,now(),$3,'{"full_name":"From Provider"}',now())`, [id, email, JSON.stringify({ provider })]); await db.query('insert into auth.identities values ($1,$2)', [id, provider]); };
  const account = async id => (await db.query('select r.role, p.approved, p.display_name, p.wpi_role_choice_pending from public.profiles p join public.user_roles r on r.user_id = p.id where p.id = $1', [id])).rows[0];
  const save = (email, role, name = '', actor = admin) => db.query('select public.admin_save_account_preset($1,$2,$3,$4) as preset', [actor, email, role, name]);
  const presets = async () => (await db.query('select public.admin_list_account_presets($1) as list', [admin])).rows[0].list.map(item => item.email);
  await signUp(admin, 'boss@wpi.edu', 'azure');
  await db.query(`update public.user_roles set role = 'admin' where user_id = $1`, [admin]);

  // Only admins manage presets, and an existing account is changed in the directory instead.
  await assert.rejects(save('new@wpi.edu', 'instructor', '', ids[0]), error => error.code === '42501');
  await assert.rejects(save('Boss@wpi.edu', 'student'), error => error.code === '23505');
  await assert.rejects(save('outsider@gmail.com', 'admin'), error => error.code === '23514');
  await assert.rejects(save('not-an-email', 'student'), error => error.code === '23514');

  // WPI sign-in: the preset role replaces the default, with no role question and no waiting for approval.
  assert.equal((await save(' Prof@WPI.edu ', 'instructor', 'Professor Preset')).rows[0].preset.email, 'prof@wpi.edu');
  await signUp(ids[0], 'prof@wpi.edu', 'azure');
  assert.deepEqual(await account(ids[0]), { role: 'instructor', approved: true, display_name: 'Professor Preset', wpi_role_choice_pending: false });
  assert.deepEqual(await presets(), [], 'a claimed preset is removed');
  const audit = (await db.query('select actor_id, old_role, new_role from public.role_audit where target_id = $1', [ids[0]])).rows;
  assert.deepEqual(audit, [{ actor_id: admin, old_role: 'student', new_role: 'instructor' }]);

  // Password sign-up by an outside instructor: approved at once, keeping the name they signed up with.
  await save('outside@example.com', 'instructor');
  await signUp(ids[1], 'outside@example.com', 'email');
  assert.deepEqual(await account(ids[1]), { role: 'instructor', approved: true, display_name: 'From Provider', wpi_role_choice_pending: false });

  // An admin preset is never claimed by a password sign-up, and waits for the WPI sign-in.
  await save('chief@wpi.edu', 'admin');
  await signUp(ids[2], 'chief@wpi.edu', 'email');
  assert.equal((await account(ids[2])).role, 'instructor');
  assert.deepEqual(await presets(), ['chief@wpi.edu']);
  await db.query('select public.admin_delete_account_preset($1,$2)', [admin, 'CHIEF@wpi.edu']);
  assert.deepEqual(await presets(), []);
  await save('lead@wpi.edu', 'admin');
  await signUp(ids[3], 'lead@wpi.edu', 'azure');
  assert.equal((await account(ids[3])).role, 'admin');

  // Without a preset nothing changes: a WPI student is still asked to choose a role.
  await signUp(ids[4], 'plain@wpi.edu', 'azure');
  assert.deepEqual(await account(ids[4]), { role: 'student', approved: true, display_name: 'From Provider', wpi_role_choice_pending: true });

  // Courses chosen in advance: a student is enrolled, an instructor becomes a teacher, at first sign-in.
  const owner = '22222222-2222-4222-8222-222222222222';
  const courseIds = [];
  for (const name of ['Algebra', 'Biology']) courseIds.push((await db.query(`insert into public.courses(name, instructor_id, code) values ($1,$2,$3) returning id`, [name, owner, name === 'Algebra' ? 'ALGEBR' : 'BYLGGY'])).rows[0].id);
  const withCourses = (email, role, courses) => db.query('select public.admin_save_account_preset($1,$2,$3,$4,$5) as preset', [admin, email, role, '', courses]);
  await assert.rejects(withCourses('ghost@wpi.edu', 'student', ['dddddddd-dddd-4ddd-8ddd-dddddddddddd']), error => error.code === '23503');
  const saved = (await withCourses('pupil@wpi.edu', 'student', [courseIds[1], courseIds[0], courseIds[0]])).rows[0].preset;
  assert.deepEqual(saved.courses.map(course => course.name), ['Algebra', 'Biology']);
  assert.equal((await db.query('select count(*)::int as n from public.course_enrollments where course_id = any($1)', [courseIds])).rows[0].n, 0, 'nobody is in the course before signing in');
  const pupil = 'a6666666-6666-4666-8666-666666666666', helper = 'a7777777-7777-4777-8777-777777777777';
  await signUp(pupil, 'pupil@wpi.edu', 'azure');
  assert.deepEqual((await db.query('select status from public.course_enrollments where student_id = $1', [pupil])).rows, [{ status: 'enrolled' }, { status: 'enrolled' }]);
  await withCourses('helper@wpi.edu', 'instructor', [courseIds[0]]);
  await signUp(helper, 'helper@wpi.edu', 'azure');
  assert.deepEqual((await db.query('select course_id, status, invited_by from public.course_teachers where teacher_id = $1', [helper])).rows, [{ course_id: courseIds[0], status: 'active', invited_by: admin }]);
  assert.equal((await db.query('select count(*)::int as n from public.course_enrollments where student_id = $1', [helper])).rows[0].n, 0);
  assert.deepEqual((await db.query('select public.admin_preset_course_options($1) as list', [admin])).rows[0].list.map(course => course.name).filter(name => ['Algebra', 'Biology'].includes(name)), ['Algebra', 'Biology']);

  // The table is closed to signed-in users.
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.account_presets'), error => error.code === '42501');
  await assert.rejects(db.query('select public.admin_list_account_presets($1)', [admin]), error => error.code === '42501');
  await db.exec('reset role');
});

test('the preset API validates input and reports an existing account plainly', async () => {
  const { createAccountService } = await import('./accounts.js');
  const calls = [];
  let failure = null;
  const service = createAccountService({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: 'secret' }, () => ({
    async rpc(name, args) { calls.push([name, args]); return failure ? { data: null, error: failure } : { data: ['admin_list_account_presets', 'admin_preset_course_options'].includes(name) ? [] : { email: args.preset_email, role: args.preset_role, display_name: args.preset_name }, error: null }; },
  }));
  const admin = { id: '99999999-9999-4999-8999-999999999999', role: 'admin' };
  await assert.rejects(service.saveAccountPreset({ ...admin, role: 'instructor' }, { email: 'a@wpi.edu', role: 'student' }), { status: 403 });
  await assert.rejects(service.listAccountPresets({ ...admin, role: 'student' }), { status: 403 });
  await assert.rejects(service.saveAccountPreset(admin, { email: 'nope', role: 'student' }), { status: 400 });
  await assert.rejects(service.saveAccountPreset(admin, { email: 'a@wpi.edu', role: 'owner' }), { status: 400 });
  await assert.rejects(service.saveAccountPreset(admin, { email: 'a@gmail.com', role: 'admin' }), { status: 400, message: /WPI email/ });
  await assert.rejects(service.saveAccountPreset(admin, { email: 'a@wpi.edu', role: 'student', name: 'x'.repeat(101) }), { status: 400 });
  assert.equal(calls.length, 0, 'invalid input never reaches the database');
  assert.deepEqual(await service.saveAccountPreset(admin, { email: ' Prof@WPI.edu ', role: 'instructor', name: ' Pat ' }), { email: 'prof@wpi.edu', role: 'instructor', display_name: 'Pat' });
  assert.deepEqual(calls[0], ['admin_save_account_preset', { actor_id: admin.id, preset_email: 'prof@wpi.edu', preset_role: 'instructor', preset_name: 'Pat', preset_courses: [] }]);
  assert.deepEqual(await service.listAccountPresets(admin), { presets: [], courses: [] });
  const course = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await service.saveAccountPreset(admin, { email: 's@wpi.edu', role: 'student', courses: [course] });
  assert.deepEqual(calls.at(-1)[1].preset_courses, [course]);
  await assert.rejects(service.saveAccountPreset(admin, { email: 's@wpi.edu', role: 'student', courses: ['not-a-course'] }), { status: 400 });
  await assert.rejects(service.saveAccountPreset(admin, { email: 's@wpi.edu', role: 'student', courses: Array(21).fill(course) }), { status: 400 });
  assert.deepEqual(await service.deleteAccountPreset(admin, 'prof@wpi.edu'), { deleted: true });
  failure = { code: '23505' };
  await assert.rejects(service.saveAccountPreset(admin, { email: 'taken@wpi.edu', role: 'student' }), { status: 409, message: /already has an account/ });
});
