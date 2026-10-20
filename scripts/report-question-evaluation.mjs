import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const runPath = resolve(process.argv[2] || 'backend/evaluations/strategy-levels-v5-final/results.json');
const reportPath = resolve('backend/docs/question-strategy-evaluation.md');
const runDirectory = relative(process.cwd(), dirname(runPath)).replaceAll('\\', '/');
const run = JSON.parse(readFileSync(runPath, 'utf8'));
const cases = JSON.parse(readFileSync('backend/strategy-comparison-cases.json', 'utf8')).cases;
const strategies = JSON.parse(readFileSync('backend/question-strategies.json', 'utf8')).strategies;
const rows = run.results.filter(item => item.status);
const paired = rows.filter(item => item.status === 'applied' && item.review);
const dims = ['clarity', 'levelFit', 'diagnosticValue', 'grounding', 'nonLeading'];
const mean = values => values.length ? (values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2) : '—';
const clean = value => String(value || '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const traceRoot = relative(dirname(reportPath), dirname(runPath)).replaceAll('\\', '/');
const lines = ['# Question-strategy live evaluation', '', `Updated: ${run.updatedAt}. Provider/model: **${run.provider} / ${run.model}**. Corpus: \`${run.corpusVersion}\`.`, '',
  '## Scope and method', '',
  'The developer tool now has 67 fixed cases: the original 16 plus 51 targeted strategy-level cases covering all 18 strategies at each supported level (Remember 2, Understand 17, Apply 16, Analyze 16). Targeted mode offers only the intended strategy, but permits abstention and rubric fallback. It tests whether a structure can be instantiated, not whether an open selector discovers it among all candidates.', '',
  'Each pair shares one rubric assessment, transcript, provider and model. The baseline receives no expected-strategy label, strategy-bearing case title, or review guide. The strategy branch receives only the eligible targeted candidate and normal planning/generation context. Authored fixture-scope rubrics narrow the original model-generated topic rubrics; both are retained. These synthetic cases are benchmark designs, not validated inventory items or an independently sampled held-out dataset. The suite samples theoretical, quantitative, and experimental learning types; it does not cover the full learning-type cross-product, design tasks, or quantitative Analyze paper-review flows.', '',
  'A separate call reviews questions under deterministic counterbalanced A/B labels, without branch identities or strategy metadata. It scores clarity, level fit, diagnostic value, grounding, and non-leading wording from 0 to 2 each. It sees the same fixed transcript, scope rubric, and diagnostic objective. Ratings are same-model design opinions, not independent expert validation or observed learner performance. The generator’s own suitability checks are not counted as quality evidence.', '',
  run.screenRule, '',
  '## Completion and quality', '',
  `Completed attempts: **${rows.length}/${run.totalCases}**. Applications: **${rows.filter(r => r.status === 'applied').length}**; fallbacks: **${rows.filter(r => r.status === 'fallback').length}**; no next question: **${rows.filter(r => r.status === 'no_question').length}**; current generation errors: **${rows.filter(r => r.status === 'error').length}**; review errors: **${rows.filter(r => r.reviewError).length}**.`, '',
  `Across ${paired.length} reviewed applications, mean baseline score: **${mean(paired.map(r => r.review.questions.baseline.total))}/10**; mean strategy score: **${mean(paired.map(r => r.review.questions.enhanced.total))}/10**. Reused fallback questions are excluded from these means.`, '',
  `Design-screen threshold met: default **${paired.filter(r => r.baselineMeetsScreen).length}/${paired.length}**; strategy **${paired.filter(r => r.enhancedMeetsScreen).length}/${paired.length}**. These are model-review classifications, not learner mastery or empirical validation.`, '',
  '| Review outcome, applied pairs only | Count |', '| --- | ---: |',
  ...['baseline', 'enhanced', 'tie', 'neither'].map(preference => `| ${preference} | ${paired.filter(r => r.review.preference === preference).length} |`), '',
  '| Dimension | Default mean /2 | Strategy mean /2 |', '| --- | ---: | ---: |',
  ...dims.map(dim => `| ${dim} | ${mean(paired.map(r => r.review.questions.baseline[dim].score))} | ${mean(paired.map(r => r.review.questions.enhanced[dim].score))} |`), '',
  '| Level | Required | Applications | Fallbacks | Current errors | Reviewed pairs | Default /10 | Strategy /10 |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...['remember', 'understand', 'apply', 'analyze'].map(level => { const subset = rows.filter(r => r.level === level), reviews = paired.filter(r => r.level === level); return `| ${level} | ${cases.filter(c => c.level === level).length} | ${subset.filter(r => r.status === 'applied').length} | ${subset.filter(r => r.status === 'fallback').length} | ${subset.filter(r => r.status === 'error').length} | ${reviews.length} | ${mean(reviews.map(r => r.review.questions.baseline.total))} | ${mean(reviews.map(r => r.review.questions.enhanced.total))} |`; }), '',
  '## Strategy-level matrix', '', 'Cells show status and default/strategy scores out of 10. A dash is an unsupported level. A pending cell is not a successful test.', '',
  '| Strategy | Remember | Understand | Apply | Analyze |', '| --- | --- | --- | --- | --- |',
  ...strategies.map(strategy => `| ${strategy.title} | ${['remember', 'understand', 'apply', 'analyze'].map(level => { if (!strategy.levels.includes(level)) return '—'; const result = rows.find(r => r.expectedStrategyId === strategy.id && r.level === level); return result ? `${result.status}${result.review ? ` ${result.review.questions.baseline.total}/${result.review.questions.enhanced.total}` : ''}` : 'pending'; }).join(' | ')} |`), '',
  '## Operational failures and abstentions', '',
  `Recorded failed generation attempts, including recovered attempts: ${rows.reduce((sum, r) => sum + r.attempts.filter(a => a.status === 'error').length, 0)}. Successful checkpoints are not regenerated on resume. Review-only retries retain the generated pair. Original failures remain in each record's attempts list.`, '',
  ...rows.filter(r => r.status !== 'applied' || r.reviewError || r.attempts.some(a => a.status === 'error')).map(r => `- **${r.caseId}** (${r.status}): ${clean(r.coverageGap?.reason || r.error || r.reviewError || 'Recovered a previously failed request; see attempts in results.json.')}`), '',
  '## Questions requiring review', '',
  'The following concerns come from the blind reviewer and need subject/expert review. They can be mistaken; a score is not an application verdict.', '',
  ...paired.filter(r => !r.enhancedMeetsScreen).flatMap(r => [`### ${r.caseId}`, '', `Strategy question: ${r.enhanced}`, '', ...r.review.questions.enhanced.concerns.map(c => `- ${c.severity}, ${c.dimension}: ${c.reason}${c.quote ? ` Quote: “${c.quote}”` : ''}`), '']),
  '## Audit trail and reproduction', '',
  `Fingerprint: \`${run.fingerprint}\`. Prompt version: \`${run.promptVersion}\`. [Full checkpoint and ratings](${traceRoot}/results.json). Full generation traces for completed comparisons are in the adjacent \`cases/\` directory. Original pilot data, including the unscoped-rubric issue, remains in \`backend/evaluations/strategy-levels-v5/\`.`, '',
  '```powershell', 'node scripts/generate-comparison-rubrics.mjs --suite coverage --concurrency 3', `node scripts/evaluate-question-strategies.mjs --concurrency 3 --output ${runDirectory}`, '# Resume operational failures without regenerating successful pairs:', `node scripts/evaluate-question-strategies.mjs --concurrency 3 --output ${runDirectory} --retry-errors`, `node scripts/report-question-evaluation.mjs ${relative(process.cwd(), runPath).replaceAll('\\', '/')}`, '```', '',
  'The saved evaluation is exposed in Developer tools → Question strategies, independently of the browser’s 20-entry manual-run history. Reload saved evaluation reads the latest checkpoint without making model calls.', '',
  'These results do not establish open-selection accuracy, robustness across model samples, independent expert agreement, transfer to unseen disciplines, accessibility for actual students, or learning gains. They identify concrete question-design and pipeline issues to investigate.'];
const notes = resolve('backend/docs/question-strategy-evaluation-review.md');
if (existsSync(notes)) lines.push('', readFileSync(notes, 'utf8'));
writeFileSync(reportPath, lines.join('\n') + '\n');
console.log(`Wrote ${reportPath}; ${rows.length}/${run.totalCases} attempts recorded.`);
