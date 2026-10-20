import { leanInstructions, evaluatorMaterial } from './refinedEvaluator.js';
export { leanInstructions } from './refinedEvaluator.js';
import { createHash, randomUUID } from 'node:crypto';
import { evaluateLegacy } from './chat.js';
import { loadPrompts } from './promptStore.js';
import { retryStructuredOutput, repairQuery } from './structuredOutput.js';
import { createEvaluationContext, completionDecision, evaluatorVersion, EvaluatorInputError } from './evaluatorContracts.js';
import { leanAssessmentTool, normalizeLeanAssessment } from './evaluatorLean.js';

export const deferredEvaluatorWork = [
  'Instructor-approved reference bundles and conflict policy; arbitrary uploads are not approved references.',
  'Professor-scored complete conversations, borderline examples, valid alternative methods, and independent human ratings with adjudication reasons.',
  'Exemplar calibration, held-out accuracy/fairness studies, and evidence-based release thresholds; normal-session activation does not establish validation.',
  'Authenticated instructor overrides, shared evidence history, transfer-task sampling, and course-specific independence/sufficiency policies.',
];

export function comparisonOptions(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || (input.mode !== undefined && !['comparison', 'ablation'].includes(input.mode)) || (input.shadow !== undefined && typeof input.shadow !== 'boolean')) throw new EvaluatorInputError('Choose comparison or ablation mode and a boolean shadow option.');
  const mode = input.mode ?? 'comparison';
  return { mode, shadow: mode === 'ablation' || input.shadow === true };
}

export function combineRefinedReviews(primary, review, context) {
  // A review can veto an eligible primary; it cannot rescue missing evidence.
  if (!primary.completion.eligible) return structuredClone(primary);
  const judgments = primary.judgments.map(j => {
    const checked = review.judgments.find(r => r.criterionId === j.criterionId);
    if (!checked) return { ...structuredClone(j), status: 'unclear', blockers: [...j.blockers, 'missing_review_judgment'] };
    return structuredClone(checked.status !== 'supported' || checked.blockers.length ? checked : j);
  });
  return { ...structuredClone(primary), judgments,
    reason: review.completion.eligible ? primary.reason : review.reason,
    nextEvidenceObjective: review.nextEvidenceObjective,
    validationIssues: [...primary.validationIssues, ...review.validationIssues],
    completion: completionDecision(context, judgments),
  };
}

export async function compareEvaluators(input, query, prompts = loadPrompts(), metadata = {}, requestedOptions = {}) {
  const options = comparisonOptions(requestedOptions);
  const context = createEvaluationContext(input);
  const calls = [];
  const traced = branch => async (instructions, messages, response, options) => {
    const call = { branch, name: response.name, request: { instructions, messages, response }, durationMs: 0 };
    calls.push(call);
    const start = Date.now();
    try { const value = await query(instructions, messages, response, options); call.response = structuredClone(value); return value; }
    catch (error) { call.error = error.message; throw error; }
    finally { call.durationMs = Date.now() - start; }
  };
  const base = { schemaVersion: 1, runId: randomUUID(), generatedAt: new Date().toISOString(), evaluatorVersion, promptVersion: prompts.version, refinedPromptVersion: createHash('sha256').update(leanInstructions).digest('hex'), ...metadata, options, refinedSchema: 'lean-v1', definitions: context.criteria, stageId: context.stageId, messages: context.messages.map(({ boardImage, ...m }) => ({ ...m, ...(boardImage ? { boardImage: '[image omitted from display; present in model request]' } : {}) })), calls, deferred: deferredEvaluatorWork, limitations: ['Developer comparison only; neither result advances a learning session.', 'Authored fixtures are smoke tests, not professor-scored examples or accuracy benchmarks.', 'Rubric decomposition, reference grounding, and independence/transfer classification are not expert-validated.'] };
  if (context.eligibility) return { ...base, skipped: context.eligibility, legacy: { assessment: null }, refined: { assessment: null }, shadow: { mode: 'shadow', status: 'not_run', reason: context.eligibility } };
  const material = evaluatorMaterial(context, prompts);
  base.taskDefinition = material.task;
  const evaluate = (branch, instructions, name) => retryStructuredOutput(async (attempt, signal) => normalizeLeanAssessment(
    await repairQuery(traced(branch), attempt, signal)(instructions, material.messages, leanAssessmentTool(context, material.task, name)), context, material.task));
  let legacyFirst = null;
  let legacyFirstCallCount = 0;
  // Both primary paths receive the same original conversation. Neither sees the other's labels.
  const [legacy, refined] = await Promise.allSettled([
    evaluateLegacy(input, traced('legacy'), prompts, { onFirstAssessment: assessment => { legacyFirst = assessment; legacyFirstCallCount = calls.filter(c => c.branch === 'legacy').length; } }),
    evaluate('refined', leanInstructions, 'evaluate_refined'),
  ]);
  base.legacy = legacy.status === 'fulfilled' ? { assessment: legacy.value } : { assessment: null, error: legacy.reason.message };
  base.refined = refined.status === 'fulfilled' ? { assessment: refined.value } : { assessment: null, error: refined.reason.message };
  // Review receives only original material. It can never mutate either primary result.
  if (options.shadow && refined.status === 'fulfilled' && refined.value.completion.eligible) {
    try {
      const assessment = await evaluate('shadow review', `${leanInstructions}\nConduct a fresh final evidence review. Recheck original student work for overlooked gaps, assistance dependence, invalid reasoning, and unresolved errors. No earlier evaluator labels are supplied. Confirm valid support without inventing stricter requirements.`, 'review_refined_shadow');
      base.shadow = { mode: 'shadow', status: 'completed', assessment, wouldBlock: !assessment.completion.eligible, differences: assessment.judgments.flatMap(j => {
        const first = refined.value.judgments.find(c => c.criterionId === j.criterionId);
        return first.status !== j.status || JSON.stringify(first.blockers) !== JSON.stringify(j.blockers) ? [{ criterionId: j.criterionId, primaryStatus: first.status, reviewStatus: j.status, reason: j.reason, blockers: j.blockers }] : [];
      }) };
    } catch (error) { base.shadow = { mode: 'shadow', status: 'error', error: error.message }; }
  } else base.shadow = { mode: 'shadow', status: 'not_run', reason: !options.shadow ? 'disabled' : refined.status === 'rejected' ? 'primary_failed' : 'primary_not_eligible' };
  if (options.mode === 'ablation') {
    const legacyCalls = calls.filter(c => c.branch === 'legacy');
    const sum = items => items.reduce((sum, c) => sum + c.durationMs, 0);
    const refinedMs = sum(calls.filter(c => c.branch === 'refined'));
    const shadowMs = sum(calls.filter(c => c.branch === 'shadow review'));
    const primary = base.refined.assessment;
    const combined = primary && (!primary.completion.eligible ? structuredClone(primary) : base.shadow.assessment ? combineRefinedReviews(primary, base.shadow.assessment, context) : null);
    base.ablation = { appliedToLearningSession: false, timing: 'Summed model-call durations, including retries; variants reuse shared calls and are not independent samples.', variants: {
      existingFirst: { assessment: legacyFirst, error: legacyFirst ? undefined : base.legacy.error, durationMs: sum(legacyCalls.slice(0, legacyFirstCallCount || legacyCalls.length)), format: 'legacy' },
      existingConfirmed: { ...base.legacy, durationMs: sum(legacyCalls), incrementalDurationMs: legacyFirst ? sum(legacyCalls.slice(legacyFirstCallCount)) : 0, confirmationStatus: legacyFirst ? legacyCalls.length > legacyFirstCallCount ? base.legacy.error ? 'error' : 'completed' : 'not_needed' : 'unavailable', format: 'legacy' },
      leanRefined: { ...base.refined, durationMs: refinedMs, format: 'refined' },
      refinedWithShadow: { assessment: combined, error: primary?.completion.eligible ? base.shadow.error : base.refined.error, durationMs: refinedMs + shadowMs, incrementalDurationMs: shadowMs, reviewStatus: base.shadow.status, format: 'refined' },
    } };
  }
  const l = base.legacy.assessment;
  const r = base.refined.assessment;
  base.comparison = { legacyComplete: l?.complete ?? null, refinedEligible: r?.completion.eligible ?? null, completionDiffers: l && r ? l.complete !== r.completion.eligible : null, policyDiffers: context.criteria.some(c => c.requiresIndependent || c.requiresTransfer || c.components.length > 1), note: 'Every rubric criterion must be met in both branches. Differences are diagnostic, not evidence that either evaluator is more accurate. Legacy does not consume refined evidence-check metadata.' };
  return base;
}
