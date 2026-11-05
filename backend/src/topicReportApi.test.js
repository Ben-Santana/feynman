import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';
import { testAuthorization, testAccountService } from './accessTestHelper.js';
import { AccountError } from './accounts.js';

async function invoke(server, url, body, method = body ? 'POST' : 'GET') {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  Object.assign(req, { method, url, headers: { host: 'localhost:3001', origin: 'http://localhost:5173', authorization: testAuthorization } });
  return new Promise(resolve => server.emit('request', req, { headers: {}, setHeader(k, v) { this.headers[k] = v; }, writeHead(status) { this.status = status; }, end(raw) { let data; try { data = JSON.parse(raw); } catch { data = raw; } resolve({ status: this.status, data, headers: this.headers }); } }));
}
const input = { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', conceptId: 'energy', topic: 'Energy', level: 'remember', learningType: 'theoretical', aspects: ['Name its unit.'], criterion: '1. Name its unit.', messages: [{ id: 'q', role: 'assistant', content: 'What is the SI unit of energy?' }, { id: 'u', role: 'user', content: 'The joule.' }] };
const raw = { reason: 'The unit is named correctly.', nextEvidenceObjective: '', judgments: ['criterion_1', 'level_task'].map(criterionId => ({ criterionId, status: 'supported', result: 'correct', reasoning: 'not_required', opportunity: 'fair', reason: 'The student names the joule.', abstentionReason: '', partialCredit: { awarded: false, reason: '' }, contradictions: [], observations: [{ messageId: 'u', quote: 'The joule.', assistance: 'none', assistanceMessageIds: [] }] })) };

test('score save failure blocks success; retry reuses evaluated evidence and returns its persisted ID', async t => {
  let calls = 0, writes = 0, snapshots = 0;
  const topicReports = {
    async prepare(_account, body) { return { sessionId: body.sessionId, input: { ...body, researchScoring: true } }; },
    async record(account, _prepared, assessment) {
      assert.equal(account.id, '11111111-1111-4111-8111-111111111111');
      assert.equal(assessment.complete, true);
      if (++writes === 1) throw new AccountError('Could not save assessment. Retry.', 503);
      return { id: 'saved-assessment', sequence: 1, payload: { goals: [{ id: 'energy:remember:1', credit: 1 }] } };
    },
    async report(_account, sessionId, options) { assert.equal(sessionId, input.sessionId); assert.equal(options.onlyIfComplete, true); snapshots++; },
  };
  const server = createApiServer({ accountService: { ...testAccountService('student'), topicReports }, chatgpt: null, env: { ANTHROPIC_API_KEY: 'test' }, query: async (_s, _m, tool) => { calls++; assert.equal(tool.name, 'evaluate_refined'); return structuredClone(raw); } });
  t.after(() => server.close());
  assert.equal((await invoke(server, '/api/chat', input)).status, 503);
  const retry = await invoke(server, '/api/chat', input);
  assert.equal(retry.status, 200); assert.equal(retry.data.assessmentRecord.id, 'saved-assessment');
  assert.equal(calls, 1); assert.equal(writes, 2); assert.equal(snapshots, 1);
});

test('report endpoints enforce authenticated ownership service and exports are admin-only attachments', async t => {
  const requests = [];
  const topicReports = {
    async report(account, sessionId, options) { requests.push({ account, sessionId, options }); if (sessionId === 'other') throw new AccountError('Session access required.', 403); return { id: 'snapshot', report: { final: { percent: 50 } } }; },
    async export(account) { assert.equal(account.role, 'admin'); return { content: 'participant_code,final_score\ncode,50\n', type: 'text/csv; charset=utf-8', filename: 'feynman-topics.csv' }; },
  };
  const student = createApiServer({ accountService: { ...testAccountService('student'), topicReports }, chatgpt: null });
  const admin = createApiServer({ accountService: { ...testAccountService('admin'), topicReports }, chatgpt: null });
  t.after(() => { student.close(); admin.close(); });
  assert.equal((await invoke(student, '/api/sessions/mine/report?mode=early', undefined, 'POST')).status, 200);
  assert.equal(requests[0].options.save, true); assert.equal(requests[0].options.mode, 'early');
  assert.equal((await invoke(student, '/api/sessions/mine/report?snapshot=old')).status, 200);
  assert.equal(requests[1].options.snapshotId, 'old');
  assert.equal((await invoke(student, '/api/sessions/other/report')).status, 403);
  assert.equal((await invoke(student, '/api/admin/research/export?kind=roster')).status, 403);
  const file = await invoke(admin, '/api/admin/research/export?kind=topics');
  assert.equal(file.status, 200); assert.match(file.headers['Content-Disposition'], /attachment/); assert.match(file.data, /code,50/);
});

test('a generated question failure cannot discard an assessment already persisted', async () => {
  const { chat } = await import('./chat.js');
  let saved = false;
  const assessment = { complete: false, reason: 'More evidence needed.', criteria: [{ aspect: 'Name its unit.', status: 'needs_clarification', result: 'undetermined', evidence: [] }], task: { status: 'needs_clarification', result: 'undetermined', evidence: [] } };
  await assert.rejects(chat(input, async () => { assert.equal(saved, true); throw new Error('Question provider failed'); }, undefined, { persistedAssessment: assessment, onAssessment: async () => { saved = true; } }), /Question provider failed/);
  assert.equal(saved, true);
});

test('resuming practice targets the selected rubric goal without evaluating previous-stage context', async () => {
  const { chat, validate } = await import('./chat.js');
  const request = { ...input, messages: [], practiceGoal: 'Name its unit.', priorMessages: input.messages };
  const result = await chat(request, async (system, _messages, tool) => {
    assert.equal(tool.name, 'respond_to_student');
    assert.match(system, /learner selected this rubric goal for practice/);
    return { message: 'Which unit would you use to measure stored energy?', expression: 'attentive' };
  });
  assert.equal(result.assessment, null); assert.equal(result.rubricFocus, 'Name its unit.');
  assert.throws(() => validate({ ...request, practiceGoal: 'A goal from another topic' }), /Choose a rubric goal/);
  assert.throws(() => validate({ ...input, practiceGoal: 'Name its unit.' }), /Choose a rubric goal/);
});

test('study summary reads the authorized selected snapshot and always resolves Claude', async t => {
  const requests = [], resolutions = [];
  const server = createApiServer({
    chatgpt: null,
    providers: { resolve(id) { resolutions.push(id); return { getStatus: () => ({ configured: true, model: 'claude-test' }) }; } },
    accountService: { ...testAccountService('student'), topicReports: { async report(_account, sessionId, options) {
      requests.push({ sessionId, options });
      if (sessionId === 'other') throw new AccountError('Session access required.', 403);
      return { report: { title: 'Ohm’s law', goals: [{ status: 'needs_work', evidence: [{ quote: 'I = VR' }] }] } };
    } } },
    query: async (_instructions, messages) => {
      assert.equal(JSON.parse(messages[0].content).goals[0].evidence[0].quote, 'I = VR');
      return { nextSteps: ['Practice rearranging Ohm’s law to isolate current.'] };
    },
  });
  t.after(() => server.close());
  const result = await invoke(server, '/api/sessions/mine/report/guidance?snapshot=old');
  assert.equal(result.status, 200);
  assert.equal(result.data.nextSteps[0], 'Practice rearranging Ohm’s law to isolate current.');
  assert.equal(requests[0].options.snapshotId, 'old');
  assert.deepEqual(resolutions, ['anthropic']);
  assert.equal((await invoke(server, '/api/sessions/other/report/guidance')).status, 403);
  assert.deepEqual(resolutions, ['anthropic'], 'authorization fails before a model is invoked');
});
