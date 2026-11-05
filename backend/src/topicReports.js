import { createHash } from 'node:crypto';
import { checklistItems } from '../../frontend/src/rubricChecklist.js';

export const scoringPolicyVersion = 'rubric-points-v1';
export const levels = ['remember', 'understand', 'apply', 'analyze'];
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const criterionId = (conceptId, level, index) => `${conceptId}:${level}:${index + 1}`;
export const eventKey = input => digest([input.assignmentConceptId || input.conceptId, input.level, input.messages]);

export function assignedGoals(configuration) {
  return configuration.concepts.flatMap(concept => levels.slice(0, levels.indexOf(concept.target) + 1).flatMap(level =>
    checklistItems(concept.rubric[level]).map((text, index) => ({ id: criterionId(concept.id, level, index), conceptId: concept.id, concept: concept.name, level, text }))));
}

// Only validated citations and an explicit, fair, substantive judgment can earn
// points. Missing/ambiguous/technically invalid evidence stays outside the score.
export function scoreJudgment(judgment, skipped = false) {
  if (skipped) return { credit: null, status: 'skipped' };
  if (!judgment) return { credit: null, status: 'not_assessed' };
  const valid = judgment.opportunity === 'fair' && !judgment.abstentionReason?.trim()
    && (judgment.observations?.length > 0 || judgment.contradictions?.length > 0) && !judgment.blockers?.includes('invalid_evidence');
  if (!valid) return { credit: null, status: 'not_assessed' };
  if (judgment.result === 'incorrect' || judgment.reasoning === 'flawed' || judgment.status === 'flawed' || judgment.contradictions?.length) return { credit: 0, status: 'needs_work' };
  if (judgment.status === 'supported' && !judgment.blockers?.length && ['correct', 'not_applicable'].includes(judgment.result) && ['valid', 'not_required'].includes(judgment.reasoning)) return { credit: 1, status: 'demonstrated' };
  if (judgment.partialCredit?.awarded === true && judgment.partialCredit.reason?.trim()
    && judgment.result === 'correct' && ['valid', 'not_required'].includes(judgment.reasoning)
    && judgment.status !== 'supported' && !judgment.blockers?.some(b => /independent|transfer/.test(b))) return { credit: 0.5, status: 'partial' };
  return { credit: null, status: 'not_assessed' };
}

export function assessmentPayload(input, assessment, metadata) {
  const conceptId = input.assignmentConceptId || input.conceptId;
  const judgments = assessment.refined?.judgments || [];
  return {
    conceptId, level: input.level, assessment,
    assistanceIds: input.messages.flatMap(m => m.assistance ? [digest([conceptId, m.id || m.content])] : []),
    versions: { scoring: scoringPolicyVersion, evaluator: assessment.refined?.evaluatorVersion || 'legacy', ...metadata },
    goals: assessment.criteria.map((criterion, index) => {
      const j = judgments.find(j => j.criterionId === `criterion_${index + 1}`);
      const { credit, status } = scoreJudgment(j, criterion.skipped);
      const observations = [...(j?.observations || []), ...(j?.contradictions || []).map(c => ({ ...c, assistance: j?.observations.find(o => o.messageId === c.messageId)?.assistance || 'unknown' }))];
      const firstIndex = observations.length ? Math.min(...observations.map(o => o.messageIndex)) : Infinity;
      const assistanceBefore = input.messages.slice(0, firstIndex).some(m => m.assistance && m.rubricFocus === criterion.aspect);
      const answer = input.messages.at(-1);
      const substantive = observations.some(o => o.messageIndex === input.messages.length - 1 && !input.messages[o.messageIndex]?.skipRubricItem && !input.messages[o.messageIndex]?.helpRequest && !input.messages[o.messageIndex]?.finishAssessment && !input.messages[o.messageIndex]?.review)
        || (j?.opportunity === 'fair' && input.messages.at(-2)?.rubricFocus === criterion.aspect && !answer?.skipRubricItem && !answer?.helpRequest && !answer?.finishAssessment && !answer?.review);
      const assisted = assistanceBefore || observations.some(o => ['hint', 'explanation_or_answer'].includes(o.assistance));
      const assistanceUnknown = observations.some(o => o.assistance === 'unknown');
      return {
        id: criterionId(conceptId, input.level, index), credit, status,
        reason: criterion.skipped ? 'You skipped this goal.' : j?.blockers?.includes('invalid_evidence') ? 'The assessment could not verify the cited evidence. Try a new answer.' : j?.partialCredit?.awarded && credit === 0.5 ? j.partialCredit.reason : j?.reason || 'There is not enough verified evidence to assess this goal.',
        evidence: observations.map(o => ({ messageId: o.messageId, messageIndex: o.messageIndex, quote: o.quote })),
        opportunity: j?.opportunity || 'unknown', substantive,
        // A fair ambiguous first answer is frozen too; a later correct response
        // must never be substituted for it.
        firstEligible: j?.opportunity === 'fair' && substantive,
        assisted, assistanceUnknown, independentCheck: j?.independentCheck || 'not_required', transferCheck: j?.transferCheck || 'not_required',
        assistanceCount: new Set([...observations.flatMap(o => o.assistanceMessageIndices || []), ...input.messages.flatMap((m, index) => m.assistance && m.rubricFocus === criterion.aspect ? [index] : [])]).size,
      };
    }),
  };
}

function score(goals, field) {
  const scored = goals.filter(g => typeof g[field] === 'number');
  const points = scored.reduce((sum, g) => sum + g[field], 0);
  return { percent: scored.length ? Math.round(points / scored.length * 1000) / 10 : null, points, scored: scored.length, assigned: goals.length, coverage: goals.length ? Math.round(scored.length / goals.length * 1000) / 10 : 0 };
}

export function buildTopicReport(context, sessionId, finishMode) {
  const goals = assignedGoals(context.configuration).map(goal => {
    const history = context.events.flatMap(event => event.payload.goals.filter(g => g.id === goal.id).map(g => ({ ...g, eventId: event.id, sequence: event.sequence, at: event.created_at, versions: event.payload.versions })));
    const legacyConcept = context.legacyDocument?.concepts?.find(c => c.id === goal.conceptId);
    const legacy = Boolean(legacyConcept?.messages?.some(m => m.role === 'user'));
    const first = history.find(g => g.firstEligible);
    // A later omission doesn't erase an earlier valid result. A skip remains
    // visible, and a later valid independent answer can replace it.
    const latest = history.findLast(g => g.status !== 'not_assessed') || history.at(-1);
    const firstCredit = !legacy && first && !first.assisted && !first.assistanceUnknown ? first.credit : null;
    let legacyEvidence = null;
    if (!latest && legacy) {
      const criterion = legacyConcept.assessments?.[goal.level]?.criteria?.find(c => c.aspect === goal.text);
      if (criterion) legacyEvidence = { status: criterion.skipped ? 'skipped' : criterion.status === 'supported' && criterion.evidence?.length ? 'demonstrated' : criterion.status === 'flawed' ? 'needs_work' : 'not_assessed', evidence: criterion.evidence || [], reason: 'Saved legacy evidence; no research score is available.' };
    }
    return { ...goal, status: latest?.status || legacyEvidence?.status || 'not_assessed',
      firstCredit, finalCredit: latest?.credit ?? null,
      firstLimitation: legacy ? 'legacy' : first?.assisted ? 'assistance_before_first_attempt' : first?.assistanceUnknown ? 'unknown_assistance_provenance' : first && first.credit === null ? 'unscorable_first_attempt' : !first ? 'no_fair_attempt' : null,
      reason: latest?.reason || legacyEvidence?.reason || 'This goal has not received a scorable assessment.',
      evidence: latest?.evidence || legacyEvidence?.evidence || [],
      firstEventId: first?.eventId || null, finalEventId: latest?.eventId || null,
      firstAt: first?.at || null, finalAt: latest?.at || null, attempts: history.filter(g => g.firstEligible).length,
      assisted: latest?.assisted || false, assistanceUnknown: latest?.assistanceUnknown || false, assistanceCount: Math.max(0, ...history.map(g => g.assistanceCount || 0)),
      independentCheck: latest?.independentCheck || 'not_required', transferCheck: latest?.transferCheck || 'not_required',
      versions: latest?.versions || null, firstVersions: first?.versions || null, legacy,
    };
  });
  const priority = { needs_work: 0, partial: 1, skipped: 2, not_assessed: 3, demonstrated: 4 };
  const priorities = goals.filter(g => g.status !== 'demonstrated').sort((a, b) => priority[a.status] - priority[b.status]).slice(0, 3).map(g => ({ goalId: g.id, conceptId: g.conceptId, level: g.level, concept: g.concept, reason: g.reason, action: `${g.status === 'needs_work' ? 'Correct your earlier explanation, then demonstrate' : g.status === 'partial' ? 'Complete the missing parts of' : 'Attempt'} this goal without notes: ${g.text}` }));
  const first = score(goals, 'firstCredit'), final = score(goals, 'finalCredit');
  const levelChecks = context.configuration.concepts.flatMap(concept => levels.slice(0, levels.indexOf(concept.target) + 1).flatMap(level => {
    const event = context.events.findLast(e => e.payload.conceptId === concept.id && e.payload.level === level);
    if (!event) return [];
    const task = event.payload.assessment?.refined?.judgments?.find(j => j.criterionId === 'level_task');
    if (!task) return [];
    return [{ conceptId: concept.id, concept: concept.name, level, supported: task.status === 'supported' && !task.blockers?.length,
      independentCheck: task.independentCheck || 'not_required', transferCheck: task.transferCheck || 'not_required', reason: task.reason,
      rubricDemonstrated: goals.filter(g => g.conceptId === concept.id && g.level === level).every(g => g.status === 'demonstrated'),
      goalId: goals.find(g => g.conceptId === concept.id && g.level === level)?.id }];
  }));
  return { schemaVersion: 1, scoringPolicyVersion, rubricVersion: digest(context.configuration), sessionId, researchCode: context.researchCode,
    title: context.configuration.title, learningType: context.configuration.learningType, assignment: context.configuration.assignment || null,
    startedAt: context.createdAt, finishMode, legacy: Boolean(context.legacyDocument),
    assistanceCount: new Set(context.events.flatMap(e => e.payload.assistanceIds || [])).size,
    watermark: Math.max(0, ...context.events.map(e => Number(e.sequence))),
    demonstrated: goals.filter(g => g.status === 'demonstrated').length, assigned: goals.length,
    first, final, fullyCovered: first.scored === goals.length && final.scored === goals.length && goals.length > 0,
    goals, priorities, levelChecks };
}

// Protect spreadsheet consumers as well as preserving commas/newlines.
export function csv(rows, columns) {
  const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  return [columns, ...rows.map(row => columns.map(c => row[c]))].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export const dataDictionary = `Feynman topic scoring: rubric-points-v1\nUnit: one rubric goal, equal weight. Overall level_task is excluded from points.\nCredit: 1 demonstrated; 0.5 explicit correct but incomplete demonstration with verified learner evidence and valid reasoning; 0 incorrect substantive attempt. Ambiguous, skipped, unasked and technically invalid judgments have no numeric credit.\nPercent = 100 * earned points / scored goals; coverage = scored goals / assigned goals. Missing percentages are blank, never zero.\nFirst attempt: earliest fair substantive assessment, frozen even if unscorable or assisted. Assisted or historical first attempts have no initial credit. This is not a topic pretest.\nFinal: latest valid criterion result at the snapshot watermark. A later absence of evidence does not erase a valid assessment. Skips remain gaps.\nfully_covered requires all goals scored on both measures. Default exports include only fully covered latest snapshots per student/topic; includeIncomplete=1 includes incomplete records. history=1 includes earlier snapshots.\nExports include only instructor-assigned topics for participants with signed consent. Participant codes are stable random identifiers. Roster matching is a separate admin-only download. No transcript quotes or student free text are included in research CSVs.\nVersions: rubric SHA-256, scoring policy, evaluator, prompts, provider/model. Different rubric versions must be analyzed separately.\nBefore study collection: instructors independently rate a sample, compare criterion and partial-credit agreement, refine definitions, and freeze the scoring policy. No calibration is implied by these records.\n`;
export function researchCsv(snapshots, kind, { includeIncomplete = false, history = false } = {}) {
  const latest = new Map();
  for (const s of snapshots) latest.set(`${s.report.researchCode}:${s.report.sessionId}`, s);
  const chosen = (history ? snapshots : [...latest.values()]).filter(s => includeIncomplete || s.report.fullyCovered);
  const rows = chosen.flatMap(s => {
    const r = s.report;
    const base = { participant_code: r.researchCode, course_id: r.assignment?.courseId, topic_id: r.assignment?.moduleId, session_id: r.sessionId, snapshot_id: s.snapshotId || s.id, snapshot_at: s.createdAt, started_at: r.startedAt, finish_mode: r.finishMode, rubric_version: r.rubricVersion, scoring_version: r.scoringPolicyVersion, fully_covered: r.fullyCovered, legacy: r.legacy };
    if (kind === 'criteria') return r.goals.map(g => ({ ...base, criterion_id: g.id, concept_id: g.conceptId, level: g.level, status: g.status, first_credit: g.firstCredit, final_credit: g.finalCredit, first_limitation: g.firstLimitation, first_event_id: g.firstEventId, final_event_id: g.finalEventId, first_at: g.firstAt, final_at: g.finalAt, attempts: g.attempts, assistance_count: g.assistanceCount, assisted: g.assisted, assistance_unknown: g.assistanceUnknown, first_evaluator_version: g.firstVersions?.evaluator, first_prompt_version: g.firstVersions?.prompt, first_provider: g.firstVersions?.provider, first_model: g.firstVersions?.model, independent_check: g.independentCheck, transfer_check: g.transferCheck, level_independent_check: r.levelChecks?.find(c => c.conceptId === g.conceptId && c.level === g.level)?.independentCheck, level_transfer_check: r.levelChecks?.find(c => c.conceptId === g.conceptId && c.level === g.level)?.transferCheck, evaluator_version: g.versions?.evaluator, prompt_version: g.versions?.prompt, provider: g.versions?.provider, model: g.versions?.model }));
    return [{ ...base, goals_assigned: r.assigned, goals_demonstrated: r.demonstrated, first_score: r.first.percent, first_points: r.first.points, first_scored: r.first.scored, first_coverage: r.first.coverage, final_score: r.final.percent, final_points: r.final.points, final_scored: r.final.scored, final_coverage: r.final.coverage, assistance_count: r.assistanceCount }];
  });
  const common = ['participant_code','course_id','topic_id','session_id','snapshot_id','snapshot_at','started_at','finish_mode','rubric_version','scoring_version','fully_covered','legacy'];
  return csv(rows, [...common, ...(kind === 'criteria' ? ['criterion_id','concept_id','level','status','first_credit','final_credit','first_limitation','first_event_id','final_event_id','first_at','final_at','attempts','assistance_count','assisted','assistance_unknown','first_evaluator_version','first_prompt_version','first_provider','first_model','independent_check','transfer_check','level_independent_check','level_transfer_check','evaluator_version','prompt_version','provider','model'] : ['goals_assigned','goals_demonstrated','first_score','first_points','first_scored','first_coverage','final_score','final_points','final_scored','final_coverage','assistance_count'])]);
}
