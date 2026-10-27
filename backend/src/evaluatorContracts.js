import { createHash } from 'node:crypto';
import { InvalidOutputError } from './structuredOutput.js';
import { validate } from './chat.js';
import { checklistItems } from '../../frontend/src/rubricChecklist.js';

export const evaluatorVersion = 'refined-evaluator-v4-lean';
export const contractVersion = 1;
export const evidenceStatuses = ['missing', 'unclear', 'flawed', 'supported'];
export const resultKinds = ['correct', 'incorrect', 'undetermined', 'not_applicable'];
export const assistanceKinds = ['none', 'clarification', 'hint', 'explanation_or_answer', 'unknown'];
const opportunities = ['not_yet', 'fair', 'compromised', 'unknown'];
const checks = ['demonstrated', 'not_demonstrated', 'not_required'];
const text = (value, max = 2000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
export class EvaluatorInputError extends Error {}

// Transport validation is shared with regular chats; definition metadata is local/dev only.
export function createEvaluationContext(input, { requireTransfer = false } = {}) {
  try { validate(input); } catch (error) { throw new EvaluatorInputError(error.message); }
  const aspects = input.criterion && /^\s*1[.)]\s/m.test(input.criterion) ? checklistItems(input.criterion) : input.aspects;
  if (!aspects.length || aspects.length > 20) throw new EvaluatorInputError('Provide 1–20 checklist items.');
  const stageId = input.stageId ?? `${input.level}_${hash(JSON.stringify([input.topic, aspects, input.evaluatorCriteria || null]))}`;
  if (!id(stageId)) throw new EvaluatorInputError('Provide a valid stageId.');
  const messages = input.messages.map((m, index) => {
    const messageId = m.id ?? `m_${hash(JSON.stringify([stageId, index, m.role, m.content, m.review || null, m.boardImage || null]))}`;
    if (!id(messageId)) throw new EvaluatorInputError('Provide valid message IDs.');
    return { ...m, id: messageId, messageIndex: index };
  });
  if (new Set(messages.map(m => m.id)).size !== messages.length) throw new EvaluatorInputError('Message IDs must be unique.');
  const definitions = input.evaluatorCriteria ?? aspects.map((aspect, index) => ({ id: `criterion_${index + 1}`, text: aspect, required: true, components: [{ id: 'whole', text: aspect }], requiresIndependent: false, requiresTransfer: false }));
  if (!Array.isArray(definitions) || definitions.length !== aspects.length) throw new EvaluatorInputError('Provide one evaluator criterion definition per checklist item.');
  const criteria = definitions.map((c, index) => {
    if (!c || !id(c.id) || c.id === 'level_task' || c.text !== aspects[index] || typeof c.required !== 'boolean' || typeof c.requiresIndependent !== 'boolean' || typeof c.requiresTransfer !== 'boolean' || !Array.isArray(c.components) || !c.components.length || c.components.length > 20 || c.components.some(p => !p || !id(p.id) || !text(p.text, 1000)) || new Set(c.components.map(p => p.id)).size !== c.components.length) throw new EvaluatorInputError('Invalid criterion definition: use exact checklist text, unique IDs, components, and boolean requirements.');
    // The rubric is authoritative. Legacy optional flags cannot waive an item.
    return { id: c.id, text: c.text, required: true, components: c.components.map(p => ({ id: p.id, text: p.text })), requiresIndependent: c.requiresIndependent || messages.some(m => m.assistance), requiresTransfer: c.requiresTransfer, level: input.level };
  });
  if (new Set(criteria.map(c => c.id)).size !== criteria.length) throw new EvaluatorInputError('Criterion IDs must be unique.');
  const paperAnalysis = input.level === 'analyze' && (input.learningType ?? 'quantitative') === 'quantitative';
  const latestPaper = messages.findLast(m => m.paper)?.paper;
  const reviewIndex = latestPaper ? messages.findLastIndex(m => m.review?.paperId === latestPaper.id) : -1;
  const eligibility = !messages.length ? 'no_learner_evidence' : paperAnalysis && (reviewIndex < 0 || !messages.slice(reviewIndex + 1).some(m => m.role === 'user' && !m.review)) ? 'awaiting_paper_review_explanation' : null;
  return { schemaVersion: contractVersion, stageId, topic: input.topic, criterion: input.criterion ?? null, level: input.level, learningType: input.learningType ?? 'quantitative', criteria, messages, reviewIndex, eligibility, requireTransfer: requireTransfer && ['apply', 'analyze'].includes(input.level) };
}

export function taskDefinition(context, taskText) {
  return { id: 'level_task', text: taskText, required: true, level: context.level, components: [{ id: 'whole', text: taskText }], requiresIndependent: context.requireTransfer || context.messages.some(m => m.assistance), requiresTransfer: Boolean(context.requireTransfer) };
}
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const string = { type: 'string', maxLength: 2000 };
const strings = { type: 'array', maxItems: 20, items: { type: 'string' } };
const observationSchema = object({ messageId: { type: 'string' }, quote: string, relevance: string, componentIds: strings, assistance: { type: 'string', enum: assistanceKinds }, assistanceMessageIds: strings, demonstratesTransfer: { type: 'boolean' } });
const judgmentSchema = object({ criterionId: { type: 'string' }, status: { type: 'string', enum: evidenceStatuses }, result: { type: 'string', enum: resultKinds }, reasoning: { type: 'string', enum: ['valid', 'flawed', 'unclear', 'not_required'] }, opportunity: { type: 'string', enum: opportunities }, reason: string, abstentionReason: string, independentCheck: { type: 'string', enum: checks }, transferCheck: { type: 'string', enum: checks }, observations: { type: 'array', maxItems: 40, items: observationSchema }, contradictions: { type: 'array', maxItems: 20, items: object({ messageId: { type: 'string' }, quote: string, reason: string }) } });
export function assessmentTool(context, name = 'evaluate_refined') {
  return { name, description: 'Return criterion evidence judgments. Application code computes completion.', schema: object({ reason: string, nextEvidenceObjective: string, judgments: { type: 'array', minItems: context.criteria.length + 1, maxItems: context.criteria.length + 1, items: judgmentSchema } }) };
}
function assertShape(result, definitions) {
  const fail = () => { throw new InvalidOutputError('Invalid refined evaluator response. Return every criterion ID exactly once with valid evidence fields.'); };
  if (!result || typeof result.reason !== 'string' || result.reason.length > 2000 || typeof result.nextEvidenceObjective !== 'string' || result.nextEvidenceObjective.length > 2000 || !Array.isArray(result.judgments) || result.judgments.length !== definitions.length) fail();
  if (new Set(result.judgments.map(j => j?.criterionId)).size !== definitions.length) fail();
  for (const d of definitions) {
    const j = result.judgments.find(j => j?.criterionId === d.id);
    if (!j || !evidenceStatuses.includes(j.status) || !resultKinds.includes(j.result) || !['valid', 'flawed', 'unclear', 'not_required'].includes(j.reasoning) || !opportunities.includes(j.opportunity) || !text(j.reason) || typeof j.abstentionReason !== 'string' || j.abstentionReason.length > 2000 || !checks.includes(j.independentCheck) || !checks.includes(j.transferCheck) || !Array.isArray(j.observations) || j.observations.length > 40 || !Array.isArray(j.contradictions) || j.contradictions.length > 20) fail();
    for (const o of j.observations) if (!o || typeof o.messageId !== 'string' || typeof o.quote !== 'string' || o.quote.length > 2000 || !text(o.relevance) || !Array.isArray(o.componentIds) || !o.componentIds.length || o.componentIds.length > 20 || o.componentIds.some(c => !d.components.some(p => p.id === c)) || !assistanceKinds.includes(o.assistance) || !Array.isArray(o.assistanceMessageIds) || o.assistanceMessageIds.length > 20 || o.assistanceMessageIds.some(m => typeof m !== 'string') || typeof o.demonstratesTransfer !== 'boolean') fail();
    for (const c of j.contradictions) if (!c || typeof c.messageId !== 'string' || typeof c.quote !== 'string' || c.quote.length > 2000 || !text(c.reason)) fail();
  }
}
function cite(context, citation) {
  const message = context.messages.find(m => m.id === citation.messageId);
  if (!message || message.role !== 'user' || !citation.quote.trim()) return null;
  // Each excerpt must occur in a single original learner field, never joined fields.
  const fields = [message.content, message.review?.explanation].filter(v => typeof v === 'string');
  const image = citation.quote === '[Whiteboard image]' && Boolean(message.boardImage);
  if (!image && !fields.some(value => value.includes(citation.quote))) return null;
  return { message, image };
}

export function normalizeAssessment(result, context, task) {
  const definitions = [...context.criteria, task];
  assertShape(result, definitions);
  const issues = [];
  const judgments = definitions.map(d => {
    const raw = result.judgments.find(j => j.criterionId === d.id);
    const observations = [];
    const seen = new Set();
    for (const o of raw.observations) {
      const source = cite(context, o);
      if (!source) { issues.push({ criterionId: d.id, code: 'invalid_citation', messageId: o.messageId }); continue; }
      const assistanceValid = o.assistanceMessageIds.every(id => context.messages.some(m => m.id === id && m.role === 'assistant' && m.messageIndex < source.message.messageIndex));
      const key = JSON.stringify([o.messageId, o.quote, [...o.componentIds].sort()]);
      if (seen.has(key)) {
        const previous = observations.find(p => p.messageId === o.messageId && p.quote === o.quote && JSON.stringify([...p.componentIds].sort()) === JSON.stringify([...o.componentIds].sort()));
        if (previous.assistance !== o.assistance || previous.demonstratesTransfer !== o.demonstratesTransfer || JSON.stringify(previous.assistanceMessageIds) !== JSON.stringify(o.assistanceMessageIds)) issues.push({ criterionId: d.id, code: 'conflicting_duplicate_observation', messageId: o.messageId });
        continue;
      }
      seen.add(key);
      const assistance = !assistanceValid || (['hint', 'explanation_or_answer'].includes(o.assistance) && !o.assistanceMessageIds.length) ? 'unknown' : o.assistance;
      if (assistance !== o.assistance) issues.push({ criterionId: d.id, code: 'invalid_assistance_source', messageId: o.messageId });
      observations.push({ ...o, assistance, assistanceMessageIds: assistanceValid ? o.assistanceMessageIds : [], id: `e_${hash(JSON.stringify([context.stageId, d.id, key]))}`, messageIndex: source.message.messageIndex, source: source.image ? 'image' : 'text' });
    }
    const contradictions = raw.contradictions.filter(c => {
      if (cite(context, c)) return true;
      issues.push({ criterionId: d.id, code: 'invalid_contradiction_citation', messageId: c.messageId }); return false;
    });
    const coveredComponents = d.components.filter(p => observations.some(o => o.componentIds.includes(p.id))).map(p => p.id);
    const blockers = [];
    if (!observations.length) blockers.push('no_valid_evidence');
    if (coveredComponents.length !== d.components.length) blockers.push('uncovered_components');
    if (raw.opportunity !== 'fair') blockers.push('no_fair_opportunity');
    if (raw.result === 'incorrect' || raw.result === 'undetermined') blockers.push('result_not_supported');
    if (raw.reasoning === 'flawed' || raw.reasoning === 'unclear') blockers.push('reasoning_not_supported');
    if (contradictions.length) blockers.push('unresolved_contradiction');
    if (raw.abstentionReason.trim()) blockers.push('abstention');
    // Never accept completion from an assessment with fabricated evidence, even if some quotes survive.
    if (issues.some(i => i.criterionId === d.id && i.code !== 'invalid_assistance_source')) blockers.push('invalid_evidence');
    if (d.requiresIndependent && (raw.independentCheck !== 'demonstrated' || !d.components.every(p => observations.some(o => o.componentIds.includes(p.id) && ['none', 'clarification'].includes(o.assistance))))) blockers.push('independent_check_needed');
    if (d.requiresTransfer && (raw.transferCheck !== 'demonstrated' || !d.components.every(p => observations.some(o => o.componentIds.includes(p.id) && o.demonstratesTransfer)))) blockers.push('transfer_check_needed');
    if (d.requiresIndependent && d.requiresTransfer && !d.components.every(p => observations.some(o => o.componentIds.includes(p.id) && o.demonstratesTransfer && ['none', 'clarification'].includes(o.assistance)))) blockers.push('independent_transfer_check_needed');
    if (d.id === 'level_task' && context.reviewIndex >= 0 && !observations.some(o => o.messageIndex > context.reviewIndex)) blockers.push('post_review_explanation_needed');
    const status = (raw.status === 'supported' && blockers.length) || (raw.status === 'flawed' && !observations.length && !contradictions.length) ? 'unclear' : raw.status;
    return { ...raw, status, proposedStatus: raw.status, required: true, observations, contradictions, coveredComponents, unresolvedComponents: d.components.filter(p => !coveredComponents.includes(p.id)).map(p => p.id), blockers };
  });
  return { schemaVersion: contractVersion, evaluatorVersion, stageId: context.stageId, reason: result.reason, nextEvidenceObjective: result.nextEvidenceObjective, judgments, validationIssues: issues, completion: completionDecision(context, judgments) };
}

export function completionDecision(context, judgments) {
  const blockers = context.eligibility ? [{ criterionId: null, code: context.eligibility }] : [];
  for (const d of [...context.criteria, { id: 'level_task', required: true }]) {
    const j = judgments.find(j => j.criterionId === d.id);
    if (!j || j.status !== 'supported') blockers.push({ criterionId: d.id, code: j ? `status_${j.status}` : 'missing_judgment' });
    for (const code of j?.blockers || []) blockers.push({ criterionId: d.id, code });
  }
  return { eligible: blockers.length === 0, blockers, policy: 'all-rubric-criteria-v2', scope: 'session_rubric_coverage', finalReview: 'shadow_only', appliedToLearningSession: false };
}
