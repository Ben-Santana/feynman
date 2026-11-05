import { AccountError } from './accounts.js';
import { assessmentPayload, buildTopicReport, eventKey, digest, researchCsv, csv, dataDictionary, levels } from './topicReports.js';
import { checklistItems } from '../../frontend/src/rubricChecklist.js';

export const validUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function createTopicReportService(getClient) {
  async function rpc(name, args) {
    const { data, error } = await getClient().rpc(name, args);
    if (error) throw new AccountError(error.code === '42501' ? 'Session access or signed consent required.' : error.code === '40001' ? 'The assessment changed. Retry saving the report.' : error.code === '23514' ? error.message : ['PGRST202', '42P01'].includes(error.code) ? 'Topic reports are not configured. Apply the latest database migration and retry.' : 'Could not save or load the topic report. Please retry.', error.code === '42501' ? 403 : ['40001', '23514'].includes(error.code) ? 409 : 503);
    return data;
  }
  async function context(account, sessionId) {
    if (!validUuid(sessionId)) throw new AccountError('Choose a valid session.', 400);
    return rpc('topic_score_context', { actor_id: account.id, target_session: sessionId });
  }
  return {
    async prepare(account, input) {
      const sessionId = input.assignmentSessionId || input.sessionId;
      const conceptId = input.assignmentConceptId || input.conceptId;
      const state = await context(account, sessionId);
      const concept = state.configuration.concepts.find(c => c.id === conceptId);
      if (!concept || !levels.includes(input.level) || levels.indexOf(input.level) > levels.indexOf(concept.target)) throw new AccountError('Choose a concept and level from the saved topic.', 400);
      const canonical = { ...input, conceptId, topic: concept.name, learningType: state.configuration.learningType, criterion: concept.rubric[input.level], aspects: checklistItems(concept.rubric[input.level]), researchScoring: true };
      const key = eventKey(canonical);
      const previous = state.events.find(e => e.event_key === key);
      return { input: canonical, state, sessionId, key, previous };
    },
    async record(account, prepared, assessment, versions) {
      return rpc('append_topic_assessment', { actor_id: account.id, target_session: prepared.sessionId, request_key: prepared.key, event_payload: assessmentPayload(prepared.input, assessment, { ...versions, rubric: digest(prepared.state.configuration) }) });
    },
    async report(account, sessionId, { save = false, mode = 'early', snapshotId, onlyIfComplete = false } = {}) {
      if (!validUuid(sessionId)) throw new AccountError('Choose a valid session.', 400);
      if (!['early', 'completed'].includes(mode)) throw new AccountError('Choose a valid finish mode.', 400);
      if (snapshotId) {
        if (!validUuid(snapshotId)) throw new AccountError('Choose a valid report.', 400);
        const saved = await rpc('read_topic_report', { actor_id: account.id, target_session: sessionId, snapshot_id: snapshotId });
        if (!saved) throw new AccountError('Report not found.', 404);
        const state = await context(account, sessionId);
        return { ...saved, snapshots: state.snapshots };
      }
      const state = await context(account, sessionId);
      const report = buildTopicReport(state, sessionId, mode);
      // Completion is computed from recorded assessments, never a browser flag.
      const completed = state.configuration.concepts.every(c => levels.slice(0, levels.indexOf(c.target) + 1).every(level => {
        const latest = state.events.findLast(e => e.payload.conceptId === c.id && e.payload.level === level)?.payload.assessment;
        return latest?.complete || latest?.readyToAdvance;
      }));
      if (onlyIfComplete && !completed) return null;
      report.finishMode = completed ? 'completed' : 'early';
      if (!save) return { report, snapshots: state.snapshots };
      const saved = await rpc('save_topic_report', { actor_id: account.id, target_session: sessionId, expected_watermark: report.watermark, mode: report.finishMode, report_document: report });
      return { ...saved, snapshots: [{ id: saved.id, createdAt: saved.createdAt, watermark: report.watermark, finishMode: report.finishMode }, ...state.snapshots.filter(s => s.id !== saved.id)] };
    },
    async export(account, params) {
      if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      const kind = params.get('kind') || 'topics';
      if (!['topics', 'criteria', 'dictionary', 'roster'].includes(kind)) throw new AccountError('Choose a valid export.', 400);
      if (kind === 'dictionary') return { content: dataDictionary, type: 'text/plain; charset=utf-8', filename: 'scoring-data-dictionary.txt' };
      const course = params.get('course');
      if (!validUuid(course)) throw new AccountError('Enter a course ID.', 400);
      const snapshots = await rpc('topic_research_export', { actor_id: account.id, target_course: course, roster: kind === 'roster' });
      const content = kind === 'roster' ? csv(snapshots.map(p => ({ participant_code: p.researchCode, name: p.name, email: p.email })), ['participant_code', 'name', 'email'])
        : researchCsv(snapshots, kind, { includeIncomplete: params.get('includeIncomplete') === '1', history: params.get('history') === '1' });
      return { content, type: 'text/csv; charset=utf-8', filename: `feynman-${kind}.csv` };
    },
  };
}
