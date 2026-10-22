import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseStarUpdates } from '../../frontend/src/courseStars.ts';

const course = { id: 'course', is_public: true, starred: false, star_count: 7 };
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const requests = [], errors = [], states = new Map();
  const updates = createCourseStarUpdates((id, starred) => new Promise((resolve, reject) => requests.push({ id, starred, resolve, reject })), (id, state) => states.set(id, state), error => errors.push(error));
  return { updates, requests, errors, states };
}

test('stars and counts update immediately and survive a refresh while saving', async () => {
  const { updates, requests, states, errors } = fixture();
  updates.toggle(course);
  assert.deepEqual(states.get(course.id), { starred: true, star_count: 8 });
  assert.deepEqual(updates.overlay(course), { ...course, starred: true, star_count: 8 });
  assert.equal(requests.length, 1);
  requests[0].resolve(); await settle();
  assert.deepEqual(states.get(course.id), { starred: true, star_count: 8 });
  assert.deepEqual(errors, []);
});

test('failed stars revert both the icon and count and report the actual error', async () => {
  const { updates, requests, states, errors } = fixture();
  const error = new Error('Could not connect.');
  updates.toggle(course);
  requests[0].reject(error); await settle();
  assert.deepEqual(states.get(course.id), { starred: false, star_count: 7 });
  assert.deepEqual(errors, [error]);
  updates.toggle(course);
  assert.equal(requests.length, 2);
  requests[1].resolve(); await settle();
});

test('rapid toggles remain interactive and persist in order for each course', async () => {
  const { updates, requests, states } = fixture();
  updates.toggle(course);
  updates.toggle({ ...course, starred: true, star_count: 8 });
  assert.deepEqual(states.get(course.id), { starred: false, star_count: 7 });
  assert.equal(requests.length, 1);
  updates.toggle({ ...course, id: 'another' });
  assert.equal(requests.length, 2);
  requests[0].resolve(); await settle();
  assert.equal(requests.length, 3);
  assert.equal(requests[2].starred, false);
  requests[2].resolve(); requests[1].resolve(); await settle();
  assert.deepEqual(states.get(course.id), { starred: false, star_count: 7 });
});

test('a failed follow-up toggle reverts to the most recently saved state', async () => {
  const { updates, requests, states, errors } = fixture();
  updates.toggle(course);
  updates.toggle({ ...course, starred: true, star_count: 8 });
  requests[0].resolve(); await settle();
  requests[1].reject(new Error('Save failed.')); await settle();
  assert.deepEqual(states.get(course.id), { starred: true, star_count: 8 });
  assert.equal(errors[0].message, 'Save failed.');
});

test('private courses cannot be starred and unstars roll back after failure', async () => {
  const { updates, requests, states } = fixture();
  updates.toggle({ ...course, is_public: false });
  assert.equal(requests.length, 0);
  const starred = { ...course, starred: true };
  updates.toggle(starred);
  assert.deepEqual(states.get(course.id), { starred: false, star_count: 6 });
  requests[0].reject(new Error('Save failed.')); await settle();
  assert.deepEqual(states.get(course.id), { starred: true, star_count: 7 });
});
