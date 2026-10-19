import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardData, sessionProgress } from '../../frontend/src/dashboardData.ts';

const student = { id: 'student', role: 'student' };
const instructor = { id: 'teacher', role: 'instructor' };
const date = day => `2026-10-${day}T12:00:00Z`;
const course = (id, day = 10) => ({ id, instructor_id: 'teacher', name: `Class ${id}`, created_at: date(day) });
const module = (id, courseId, published = true) => ({ id, course_id: courseId, title: `Module ${id}`, created_at: date(11), published_at: published ? date(12) : null });
const session = (id, { started = true, passed = 1, day = 15, moduleId, courseId = 'a' } = {}) => ({
  id, title: id, updatedAt: Date.parse(date(day)), started, activeId: 'concept',
  concepts: [{ id: 'concept', name: 'Concept', target: 'apply', passed }],
  ...(moduleId ? { assignment: { moduleId, courseId, courseName: `Class ${courseId}` } } : {}),
});
const empty = { courses: [], modules: [], enrollments: [] };

test('incomplete sessions exclude completed work and sort by latest activity without mutating inputs', () => {
  const sessions = [session('older'), session('complete', { passed: 3, day: 18 }), session('draft', { started: false, day: 17 }), session('newer', { day: 16 })];
  const result = dashboardData(student, sessions, empty);
  assert.deepEqual(result.incomplete.map(record => record.id), ['draft', 'newer', 'older']);
  assert.deepEqual(result.todos.map(todo => todo.session.id), ['draft']);
  assert.deepEqual(sessions.map(record => record.id), ['older', 'complete', 'draft', 'newer']);
});

test('student tasks only include unstarted published modules in enrolled courses', () => {
  const data = {
    courses: [course('a'), course('pending'), course('rejected'), course('other')],
    enrollments: [{ course_id: 'a', status: 'enrolled' }, { course_id: 'pending', status: 'pending' }, { course_id: 'rejected', status: 'rejected' }],
    modules: [module('new', 'a'), module('started', 'a'), module('complete', 'a'), module('draft', 'a', false), module('pending', 'pending'), module('rejected', 'rejected'), module('other', 'other')],
  };
  const result = dashboardData(student, [session('started', { moduleId: 'started' }), session('complete', { moduleId: 'complete', passed: 3 })], data);
  assert.deepEqual(result.todos.map(todo => todo.id), ['module-new']);
  assert.equal(result.todos[0].path, '/courses/a');
  assert.equal(result.recentClasses.length, 3);
});

test('instructors get editable drafts in their own classes and no student module tasks', () => {
  const data = { courses: [course('a'), { ...course('other'), instructor_id: 'another' }], enrollments: [], modules: [module('published', 'a'), module('draft', 'a', false), module('other-draft', 'other', false)] };
  const result = dashboardData(instructor, [], data);
  assert.deepEqual(result.todos.map(todo => todo.id), ['module-draft']);
  assert.equal(result.todos[0].path, '/courses/a/modules/draft/edit');
  assert.deepEqual(result.recentClasses.map(item => item.course.id), ['a']);
  assert.deepEqual(dashboardData({ id: 'admin', role: 'admin' }, [], data).recentClasses, []);
});

test('recent classes use session and module activity rather than only creation dates', () => {
  const data = { courses: [course('a'), course('b', 16), course('c')], enrollments: ['a', 'b', 'c'].map(course_id => ({ course_id, status: 'enrolled' })), modules: [{ ...module('new', 'c'), published_at: date(17) }] };
  const result = dashboardData(student, [session('recent', { moduleId: 'started', day: 18 })], data);
  assert.deepEqual(result.recentClasses.map(item => item.course.id), ['a', 'c', 'b']);
});

test('session progress counts target levels, caps over-completed concepts, and handles setup and empty sessions', () => {
  const record = session('progress');
  record.concepts.push({ target: 'remember', passed: 4 });
  assert.equal(sessionProgress(record), 50);
  assert.equal(sessionProgress({ ...record, started: false }), 0);
  assert.equal(sessionProgress({ ...record, concepts: [] }), 0);
  assert.deepEqual(dashboardData(student, [], empty), { incomplete: [], todos: [], recentClasses: [] });
});
