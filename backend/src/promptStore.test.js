import { accessCookie } from './accessTestHelper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { loadPrompts, listPrompts, savePrompt, promptFile } from './promptStore.js';
import { chat, generateRubric } from './chat.js';
import { createApiServer } from './server.js';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'feynman-prompts-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'prompts.json');
  writeFileSync(path, readFileSync(promptFile));
  return path;
}
const input = { learningType: 'quantitative', level: 'analyze', topic: 'Ohm’s law', aspects: ['Identify and explain solution errors.'], criterion: '1. Identify and explain solution errors.', messages: [] };

test('saving a prompt persists one known field and leaves other prompts intact', t => {
  const path = fixture(t);
  const before = listPrompts(path);
  const text = 'Ask a short question as a classroom student.';
  const after = savePrompt({ id: 'chat.classroomRole', text, version: before.version }, path);
  assert.notEqual(after.version, before.version);
  assert.equal(JSON.parse(readFileSync(path, 'utf8'))['chat.classroomRole'], text);
  assert.deepEqual(after.prompts.filter(p => p.id !== 'chat.classroomRole'), before.prompts.filter(p => p.id !== 'chat.classroomRole'));
});

test('stale edits, unknown IDs, empty prompts, and invalid variables never overwrite the file', t => {
  const path = fixture(t);
  const before = listPrompts(path);
  for (const update of [
    { id: '../../server.js', text: 'overwrite' },
    { id: 'chat.context', text: 'Missing required variables.' },
    { id: 'chat.openingRemember', text: 'Teach {{topic}} and {{secret}}.' },
    { id: 'chat.classroomRole', text: '' },
    { id: 'chat.classroomRole', text: 'x'.repeat(30001) },
  ]) {
    assert.throws(() => savePrompt({ ...update, version: before.version }, path));
    assert.equal(listPrompts(path).version, before.version);
  }
  savePrompt({ id: 'chat.classroomRole', text: 'Changed elsewhere.', version: before.version }, path);
  assert.throws(() => savePrompt({ id: 'chat.classroomRole', text: 'Stale edit.', version: before.version }, path), error => error.status === 409);
  assert.equal(loadPrompts(path).text('chat.classroomRole'), 'Changed elsewhere.');
});

test('template substitution preserves curriculum strings and snapshots remain stable during a request', t => {
  const path = fixture(t);
  const snapshot = loadPrompts(path);
  assert.equal(snapshot.text('chat.openingRemember', { topic: '{{topic}} $&' }), 'Teach me about {{topic}} $&.');
  savePrompt({ id: 'chat.openingRemember', text: 'Tell me about {{topic}}.', version: snapshot.version }, path);
  assert.equal(snapshot.text('chat.openingRemember', { topic: 'circuits' }), 'Teach me about circuits.');
  assert.equal(loadPrompts(path).text('chat.openingRemember', { topic: 'circuits' }), 'Tell me about circuits.');
});

test('fresh chat, scenario, and rubric requests use saved prompts', async t => {
  const path = fixture(t);
  for (const [id, text] of [['chat.submitPapers', 'CUSTOM PAPER INSTRUCTION'], ['profile.theoretical.scenarios.analyze', 'CUSTOM SCENARIO'], ['rubric.writingGuidance', 'CUSTOM RUBRIC GUIDANCE']]) {
    savePrompt({ id, text, version: listPrompts(path).version }, path);
  }
  const exercise = { problem: 'Find 2 + 2.', steps: ['Add the terms.', 'The sum is four.'], conclusion: '4' };
  await chat(input, async system => { assert.match(system, /CUSTOM PAPER INSTRUCTION/); return { message: 'Grade these.', paper: { exercises: [exercise, exercise, exercise] } }; }, loadPrompts(path));
  await chat({ ...input, learningType: 'theoretical' }, async system => { assert.match(system, /CUSTOM SCENARIO/); return { message: 'What do you notice?' }; }, loadPrompts(path));
  await generateRubric({ concepts: [{ name: 'Circuits', target: 'remember' }] }, async system => {
    assert.match(system, /CUSTOM RUBRIC GUIDANCE/);
    return { concepts: [{ name: 'Circuits', rubric: { remember: ['Names circuit components.'], understand: [], apply: [], analyze: [] } }] };
  }, loadPrompts(path));
});

async function invoke(server, { method = 'GET', url = '/api/developer/prompts', body, host = 'localhost:5173', origin = 'http://localhost:5173' } = {}) {
  const cookie = await accessCookie(server);
  const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
  Object.assign(req, { method, url, headers: { cookie, host, ...(origin ? { origin } : {}) } });
  return new Promise(resolve => {
    const res = { status: 200, setHeader() {}, writeHead(status) { this.status = status; }, end(data) { resolve({ status: this.status, data: JSON.parse(data) }); } };
    server.listeners('request')[0](req, res);
  });
}

test('developer API edits files without an API key and blocks remote origins and hosts', async t => {
  const path = fixture(t);
  const server = createApiServer({ promptsPath: path });
  t.after(() => server.close());
  const loaded = await invoke(server);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.data.file, 'backend/prompts.json');
  const update = { id: 'chat.openingRemember', text: 'Tell me about {{topic}}.', version: loaded.data.version };
  for (const headers of [{ origin: 'https://untrusted.example' }, { host: 'untrusted.example', origin: undefined }]) {
    assert.equal((await invoke(server, { method: 'POST', body: update, ...headers })).status, 403);
    assert.equal(listPrompts(path).version, loaded.data.version);
  }
  assert.equal((await invoke(server, { method: 'POST', body: '{' })).status, 400);
  const saved = await invoke(server, { method: 'POST', body: update });
  assert.equal(saved.status, 200);
  assert.equal(loadPrompts(path).text('chat.openingRemember', { topic: 'circuits' }), 'Tell me about circuits.');
  assert.equal((await invoke(server, { method: 'POST', body: update })).status, 409);
});

test('invalid prompt files produce a recoverable API error', async t => {
  const path = fixture(t);
  writeFileSync(path, '{invalid');
  const server = createApiServer({ promptsPath: path });
  t.after(() => server.close());
  const response = await invoke(server);
  assert.equal(response.status, 500);
  assert.match(response.data.error, /valid JSON/);
});
