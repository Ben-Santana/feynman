import { evaluatorTestCases, evaluatorSuiteVersion } from './evaluatorTestCases.js';

// These checks compare a real run to authored screening expectations. They do not
// establish expert agreement, validity, fairness, or gains in student learning.
export function screenEvaluatorRun(testCase, run, branch) {
  const assessment = run[branch]?.assessment;
  if (!assessment) return { status: 'error', checks: [], error: run[branch]?.error || run.skipped || 'No assessment returned.' };
  if (branch === 'refined' && assessment.judgments.some(j => j.abstentionReason?.trim())) return { status: 'abstained', checks: [], reason: assessment.judgments.filter(j => j.abstentionReason?.trim()).map(j => j.abstentionReason).join('; ') };
  const eligible = branch === 'legacy' ? assessment.complete : assessment.completion.eligible;
  const checks = [{ name: 'level_completion', expected: testCase.expected.eligible, actual: eligible, passed: eligible === testCase.expected.eligible }];
  testCase.expected.criterionStatuses.forEach((allowed, index) => {
    const judgment = branch === 'legacy' ? assessment.criteria[index] : assessment.judgments.find(j => j.criterionId === (testCase.input.evaluatorCriteria?.[index]?.id || `criterion_${index + 1}`));
    const status = judgment?.status === 'needs_clarification' ? 'unclear' : judgment?.status;
    checks.push({ name: `criterion_${index + 1}`, expected: allowed, actual: status ?? null, passed: allowed.includes(status) });
  });
  return { status: checks.every(c => c.passed) ? 'matched' : 'mismatched', eligible, falseCompletion: !testCase.expected.eligible && eligible, unnecessaryBlock: testCase.expected.eligible && !eligible, checks };
}

export function summarizeEvaluatorScreens(records) {
  return Object.fromEntries(['legacy', 'refined'].map(branch => {
    const screens = records.map(r => r[branch]);
    return [branch, { attempted: screens.length, matched: screens.filter(r => r.status === 'matched').length, mismatched: screens.filter(r => r.status === 'mismatched').length, errors: screens.filter(r => r.status === 'error').length, abstentions: screens.filter(r => r.status === 'abstained').length, falseCompletions: screens.filter(r => r.falseCompletion).length, unnecessaryBlocks: screens.filter(r => r.unnecessaryBlock).length }];
  }));
}

export function screenEvaluatorComparison(testCase, run) {
  const legacy = screenEvaluatorRun(testCase, run, 'legacy');
  const refined = screenEvaluatorRun(testCase, run, 'refined');
  let shadow = { status: 'not_run', outcome: 'not_run' };
  if (run.shadow?.status === 'error') shadow = { status: 'error', outcome: 'error', error: run.shadow.error };
  else if (run.shadow?.status === 'completed') {
    const screen = screenEvaluatorRun(testCase, { refined: { assessment: run.shadow.assessment } }, 'refined');
    const primaryEligible = run.refined?.assessment?.completion.eligible;
    const reviewEligible = run.shadow.assessment?.completion.eligible;
    const comparable = primaryEligible === true && ['matched', 'mismatched'].includes(screen.status);
    const outcome = !comparable ? 'unscorable' : !testCase.expected.eligible
      ? reviewEligible ? 'missed_false_completion' : 'caught_false_completion'
      : reviewEligible ? 'confirmed_correct_completion' : 'blocked_correct_completion';
    shadow = { ...screen, outcome };
  }
  const ablation = run.ablation && Object.fromEntries(Object.entries(run.ablation.variants).map(([key, variant]) => [key, { ...screenEvaluatorRun(testCase, { [variant.format]: variant }, variant.format), durationMs: variant.durationMs, incrementalDurationMs: variant.incrementalDurationMs }]));
  return { legacy, refined, shadow, ...(ablation ? { ablation } : {}), policySensitive: testCase.tags.includes('policy-sensitive'),
    limitation: 'Authored expectations, not expert-scored accuracy. Policy-sensitive cases give the refined evaluator additional metadata. Shadow outcomes never change primary completion.' };
}

export function summarizeEvaluatorComparisons(records) {
  const scored = r => ['matched', 'mismatched'].includes(r.status);
  const paired = records.filter(r => scored(r.legacy) && scored(r.refined));
  const outcomes = records.map(r => r.shadow?.outcome);
  const ablationRecords = records.filter(r => r.ablation);
  const ablation = ablationRecords.length ? {
    variants: Object.fromEntries(['existingFirst', 'existingConfirmed', 'leanRefined', 'refinedWithShadow'].map(key => {
      const values = ablationRecords.map(r => r.ablation[key]);
      return [key, { attempted: values.length, matched: values.filter(v => v.status === 'matched').length, mismatched: values.filter(v => v.status === 'mismatched').length, errors: values.filter(v => v.status === 'error').length, abstentions: values.filter(v => v.status === 'abstained').length, falseCompletions: values.filter(v => v.falseCompletion).length, unnecessaryBlocks: values.filter(v => v.unnecessaryBlock).length, meanSummedCallMs: values.reduce((sum, v) => sum + v.durationMs, 0) / values.length }];
    })),
    effects: Object.fromEntries([['confirmation', 'existingFirst', 'existingConfirmed'], ['shadow', 'leanRefined', 'refinedWithShadow']].map(([label, before, after]) => {
      const comparable = ablationRecords.filter(r => typeof r.ablation[before]?.eligible === 'boolean' && typeof r.ablation[after]?.eligible === 'boolean');
      return [label, { comparable: comparable.length, correctedFalseCompletions: comparable.filter(r => r.ablation[before].falseCompletion && !r.ablation[after].eligible).length, introducedBlocks: comparable.filter(r => r.ablation[before].eligible && r.ablation[after].unnecessaryBlock).length }];
    })),
  } : undefined;
  return { ...(ablation ? { ablation } : {}), branches: summarizeEvaluatorScreens(records), paired: {
    comparable: paired.length,
    refinedOnlyMatched: paired.filter(r => r.refined.status === 'matched' && r.legacy.status !== 'matched').length,
    legacyOnlyMatched: paired.filter(r => r.legacy.status === 'matched' && r.refined.status !== 'matched').length,
    bothMatched: paired.filter(r => r.refined.status === 'matched' && r.legacy.status === 'matched').length,
    bothMismatched: paired.filter(r => r.refined.status !== 'matched' && r.legacy.status !== 'matched').length,
    policySensitive: paired.filter(r => r.policySensitive).length,
  }, shadow: {
    reviewed: outcomes.filter(o => o && !['not_run', 'error'].includes(o)).length,
    falseCompletionOpportunities: outcomes.filter(o => ['caught_false_completion', 'missed_false_completion'].includes(o)).length,
    caughtFalseCompletions: outcomes.filter(o => o === 'caught_false_completion').length,
    missedFalseCompletions: outcomes.filter(o => o === 'missed_false_completion').length,
    blockedCorrectCompletions: outcomes.filter(o => o === 'blocked_correct_completion').length,
    confirmedCorrectCompletions: outcomes.filter(o => o === 'confirmed_correct_completion').length,
    errors: outcomes.filter(o => o === 'error').length,
    unscorable: outcomes.filter(o => o === 'unscorable').length,
  } };
}

export { evaluatorTestCases, evaluatorSuiteVersion };
