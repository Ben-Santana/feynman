import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createAccountService } from './accounts.js';
import { createApiServer } from './server.js';
import { testAccountService, testAuthorization } from './accessTestHelper.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin = { id, role: 'admin' };
function fixture(error = null) {
  const calls = [];
  const service = createAccountService({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: 'private' }, (_url, key) => {
    calls.push({ key });
    return { async rpc(name, args) { calls.push({ name, args }); return { data: { courses: [], modules: [] }, error }; } };
  });
  return { calls, service };
}
function invoke(server, url, { authorization = testAuthorization, method = 'GET' } = {}) {
  const req = Readable.from([]);
  Object.assign(req, { method, url, headers: { host: 'localhost:5173', origin: 'http://localhost:5173', authorization } });
  return new Promise(resolve => server.emit('request', req, {
    setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); },
  }));
}

test('course administration validates inputs before using backend-only RPCs', async () => {
  const { service, calls } = fixture();
  for (const role of ['student', 'instructor']) {
    await assert.rejects(service.listCourses({ ...admin, role }, new URLSearchParams()), error => error.status === 403);
    await assert.rejects(service.viewCourse({ ...admin, role }, id), error => error.status === 403);
  }
  for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=100001', 'page=NaN', `search=${'x'.repeat(201)}`]) await assert.rejects(service.listCourses(admin, new URLSearchParams(query)), error => error.status === 400);
  await assert.rejects(service.viewCourse(admin, 'invalid'), error => error.status === 400);
  assert.deepEqual(calls, []);
  await service.listCourses(admin, new URLSearchParams('page=2&search= Physics '));
  await service.viewCourse(admin, id);
  assert.deepEqual(calls, [
    { key: 'private' }, { name: 'admin_list_courses', args: { actor_id: id, page_number: 2, search_text: 'Physics' } },
    { key: 'private' }, { name: 'admin_view_course', args: { actor_id: id, target_course: id } },
  ]);
});

test('course administration reports missing records, permission changes, and missing migrations', async () => {
  for (const [code, status, message] of [['42501', 403, /Admin access/], ['P0002', 404, /not found/], ['PGRST202', 503, /migrations/], ['42P01', 503, /migrations/], ['unknown', 503, /Could not load/]]) {
    await assert.rejects(fixture({ code }).service.viewCourse(admin, id), error => error.status === status && message.test(error.message));
  }
});

test('course routes require an admin and expose only GET listing and detail endpoints', async t => {
  for (const role of ['student', 'instructor']) {
    const server = createApiServer({ accountService: testAccountService(role) }); t.after(() => server.close());
    for (const path of ['/api/admin/courses', `/api/admin/courses/${id}`]) assert.equal((await invoke(server, path)).status, 403);
  }
  const { service } = fixture();
  const server = createApiServer({ accountService: { ...testAccountService(), listCourses: service.listCourses, viewCourse: service.viewCourse } }); t.after(() => server.close());
  assert.equal((await invoke(server, '/api/admin/courses', { authorization: '' })).status, 401);
  assert.equal((await invoke(server, '/api/admin/courses?page=2&search=Physics')).status, 200);
  assert.equal((await invoke(server, `/api/admin/courses/${id}`)).status, 200);
  assert.equal((await invoke(server, '/api/admin/courses/invalid')).status, 400);
  assert.equal((await invoke(server, '/api/admin/courses?page=-1')).status, 400);
  for (const method of ['PATCH', 'POST', 'DELETE']) assert.equal((await invoke(server, `/api/admin/courses/${id}`, { method })).status, 404);
});
