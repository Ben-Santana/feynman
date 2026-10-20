import fs from 'node:fs';
import crypto from 'node:crypto';
import { summarizeEvaluatorComparisons } from '../../src/evaluatorBenchmark.js';

const dir = new URL('./', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, dir), 'utf8'));
const rounds = [1, 2, 3].map(n => read(`round-${n}-runs.json`));
const runs = rounds.flat();
const manifest = read('manifest.json');
if (rounds.some(r => r.length !== 6) || new Set(runs.map(r => r.runId)).size !== 18) throw Error('Incomplete or duplicate rounds');
if (runs.some(r => r.model !== manifest.model || r.options.mode !== 'ablation' || r.refinedSchema !== 'lean-v1')) throw Error('Unexpected run configuration');
const keys = ['existingFirst', 'existingConfirmed', 'leanRefined', 'refinedWithShadow'];
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: values.length, meanMs: values.reduce((a, b) => a + b, 0) / values.length, medianMs: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2, minMs: sorted[0], maxMs: sorted.at(-1) };
};
const norm = s => s === 'needs_clarification' ? 'unclear' : s;
const cases = manifest.cases.map(c => {
  const repeats = rounds.map(round => round.find(r => r.case.id === c.id));
  if (repeats.some(r => !r)) throw Error(`Missing case ${c.id}`);
  return { id: c.id, variants: Object.fromEntries(keys.map(key => {
    const values = repeats.map(r => {
      const v = r.ablation.variants[key];
      const a = v.assessment;
      return { eligible: r.screening.ablation[key].eligible, screen: r.screening.ablation[key].status, criteria: a ? (v.format === 'legacy' ? a.criteria.map(j => norm(j.status)) : c.input.aspects.map((_, i) => norm(a.judgments.find(j => j.criterionId === `criterion_${i + 1}`)?.status))) : null, task: a ? norm(v.format === 'legacy' ? a.task?.status : a.judgments.find(j => j.criterionId === 'level_task')?.status) : null };
    });
    return [key, { repeats: values, completionConsistent: new Set(values.map(v => v.eligible)).size === 1, criterionLabelsConsistent: new Set(values.map(v => JSON.stringify(v.criteria))).size === 1, taskLabelConsistent: new Set(values.map(v => v.task)).size === 1 }];
  })) };
});
const summary = {
  model: manifest.model, runs: runs.length, uniqueCases: cases.length, repeats: 3,
  screening: summarizeEvaluatorComparisons(runs.map(r => r.screening)),
  latency: Object.fromEntries(keys.map(key => [key, stats(runs.map(r => r.ablation.variants[key].durationMs))])),
  additionalStages: Object.fromEntries(['existingConfirmed', 'refinedWithShadow'].map(key => [key, stats(runs.map(r => r.ablation.variants[key].incrementalDurationMs).filter(n => n > 0))])),
  callCounts: runs.flatMap(r => r.calls).reduce((a, c) => ({ ...a, [c.branch]: (a[c.branch] || 0) + 1 }), {}),
  versions: Object.fromEntries(['evaluatorVersion', 'promptVersion', 'refinedPromptVersion'].map(k => [k, [...new Set(runs.map(r => r[k]))]])),
  sourceHashesUnchanged: Object.entries(manifest.sourceHashes).every(([path, expected]) => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex') === expected),
  cases,
};
fs.writeFileSync(new URL('all-runs.json', dir), JSON.stringify(runs, null, 2));
fs.writeFileSync(new URL('summary.json', dir), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, cases: cases.filter(c => Object.values(c.variants).some(v => !v.completionConsistent || !v.criterionLabelsConsistent || !v.taskLabelConsistent)) }, null, 2));
