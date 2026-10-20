// Live, resumable developer benchmark. No mock responses or training examples.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, renameSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const base = process.env.FEYNMAN_API_ORIGIN || 'http://127.0.0.1:3001';
const provider = argument('--provider') || 'chatgpt';
const concurrency = Number(argument('--concurrency') || 3);
const limit = Number(argument('--limit') || Infinity);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3 || limit < 1) throw new Error('Use concurrency 1–3 and a positive limit.');
const directory = resolve(argument('--output') || 'backend/evaluations/strategy-levels-v5-final');
mkdirSync(join(directory, 'cases'), { recursive: true });
const headers = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Feynman-Provider': provider };
async function request(path, body, timeout = 360000) {
  const response = await fetch(base + path, { headers, signal: AbortSignal.timeout(timeout), ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || 'Request failed.'}`);
  return data;
}
const unlocked = await fetch(base + '/api/access', { method: 'POST', headers, body: JSON.stringify({ code: '6767' }), signal: AbortSignal.timeout(10000) });
if (!unlocked.ok) throw new Error('Could not unlock the local API.');
headers.Cookie = unlocked.headers.get('set-cookie').split(';')[0];
const health = await request('/api/health');
if (!health.configured) throw new Error('Configure the selected model connection before running the suite.');
const model = argument('--model') || (provider === 'chatgpt' ? (await request('/api/ai/models')).models[0]?.slug : health.model);
if (model) headers['X-Feynman-Model'] = model;
const listed = await request('/api/developer/question-comparison');
const allCases = listed.cases.filter(item => item.expectedStrategyId);
if (allCases.length !== 51) throw new Error('Expected all 51 supported strategy-level cases from the running API. Restart the backend after adding them.');
const selectedIds = argument('--case-ids')?.split(',');
if (selectedIds?.some(id => !allCases.some(item => item.id === id))) throw new Error('Unknown selected case.');
const cases = selectedIds ? allCases.filter(item => selectedIds.includes(item.id)) : allCases;
const promptVersion = (await request('/api/developer/prompts')).version;
const files = ['backend/src/questionTargeting.js', 'backend/src/strategyComparison.js', 'backend/src/strategyPlanning.js', 'backend/src/questionEvaluation.js', 'backend/src/chat.js', 'backend/question-strategies.json', 'backend/strategy-comparison-cases.json', 'backend/comparison-rubrics.json'];
const sourceHashes = Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const identity = { schemaVersion: 1, scope: selectedIds ? 'affected leakage and leading-question regressions' : 'full strategy-level coverage', coverageCases: allCases.length, provider, model, corpusVersion: listed.corpusVersion, promptVersion, caseIds: cases.map(item => item.id), sourceHashes };
const fingerprint = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
const checkpointPath = join(directory, 'results.json');
let saved = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : null;
if (saved && saved.fingerprint !== fingerprint) throw new Error('Benchmark inputs or implementation changed. Choose a new --output directory to preserve the earlier run.');
saved ||= { ...identity, fingerprint, startedAt: new Date().toISOString(), totalCases: cases.length, results: [] };
writeFileSync(join(directory, 'fixtures.json'), JSON.stringify(cases, null, 2) + '\n');
const reuseFrom = argument('--reuse-from');
if (reuseFrom && !saved.results.length) {
  const sourcePath = resolve(reuseFrom);
  const sourceRun = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const sourceCases = JSON.parse(readFileSync(join(dirname(sourcePath), 'fixtures.json'), 'utf8'));
  const codeFiles = files.filter(file => !file.endsWith('.json'));
  if (sourceRun.provider !== provider || sourceRun.model !== model || sourceRun.promptVersion !== promptVersion || codeFiles.some(file => sourceRun.sourceHashes[file] !== sourceHashes[file])) throw new Error('Reuse requires the same provider, model, prompts, and generation/review implementation.');
  for (const record of sourceRun.results) {
    const before = sourceCases.find(item => item.id === record.caseId);
    const after = cases.find(item => item.id === record.caseId);
    if (!before || !after || JSON.stringify(before) !== JSON.stringify(after) || !record.status) continue;
    if (record.traceFile) copyFileSync(join(dirname(sourcePath), record.traceFile), join(directory, record.traceFile));
    saved.results.push({ ...record, reusedFrom: relative(directory, sourcePath).replaceAll('\\', '/'), reusedFingerprint: sourceRun.fingerprint });
  }
  console.log(`Reused ${saved.results.length} unchanged case records; changed fixtures will run again.`);
}
const dimensions = ['clarity', 'levelFit', 'diagnosticValue', 'grounding', 'nonLeading'];
const writeAtomic = (path, data) => { const temporary = `${path}.tmp`; writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n'); renameSync(temporary, path); };
const meetsScreen = value => Boolean(value && value.total >= 8 && dimensions.every(key => value[key].score >= 1) && !value.concerns.some(item => item.severity === 'major'));
function checkpoint() {
  const paired = saved.results.filter(item => item.status === 'applied' && item.review?.questions);
  const average = branch => paired.length ? Math.round(paired.reduce((sum, item) => sum + item.review.questions[branch].total, 0) / paired.length * 100) / 100 : null;
  saved.updatedAt = new Date().toISOString();
  saved.summary = { attempted: saved.results.length, total: cases.length, applied: saved.results.filter(item => item.status === 'applied').length, fallback: saved.results.filter(item => item.status === 'fallback').length, noQuestion: saved.results.filter(item => item.status === 'no_question').length, errors: saved.results.filter(item => item.status === 'error').length, reviewErrors: saved.results.filter(item => item.reviewError).length, reviewedApplications: paired.length, baselineMean: average('baseline'), enhancedMean: average('enhanced'), baselineMeetsScreen: paired.filter(item => meetsScreen(item.review.questions.baseline)).length, enhancedMeetsScreen: paired.filter(item => meetsScreen(item.review.questions.enhanced)).length, preferences: Object.fromEntries(['baseline', 'enhanced', 'tie', 'neither'].map(key => [key, paired.filter(item => item.review.preference === key).length])) };
  saved.screenRule = 'All five dimensions >= 1, total >= 8/10, no major concern. Applied pairs only; fallbacks, no-question runs and errors excluded from quality means.';
  saved.limitations = 'One retained complete pair per authored strategy-level case, with recorded operational retries and a blind same-model design review. Targeted candidates can abstain. This is not open-selector coverage, independent expert validation, or evidence of learning gains.';
  writeAtomic(checkpointPath, saved);
  writeAtomic('backend/question-evaluation-results.json', saved);
}
async function evaluate(fixture) {
  const previous = saved.results.find(item => item.caseId === fixture.id);
  if (previous?.status && (!process.argv.includes('--retry-errors') || (previous.status !== 'error' && !previous.reviewError))) { console.log(`Saved already: ${fixture.id}`); return; }
  const record = previous || { caseId: fixture.id, title: fixture.title, level: fixture.level, learningType: fixture.learningType, expectedStrategyId: fixture.expectedStrategyId, attempts: [] };
  if (!previous) saved.results.push(record);
  const started = Date.now();
  console.log(`Comparing ${fixture.id}...`);
  try {
    if (!previous?.status || previous.status === 'error') {
      const result = await request('/api/developer/question-comparison', { caseId: fixture.id });
      if (result.promptVersion !== promptVersion || result.corpusVersion !== listed.corpusVersion) throw new Error('Version changed during the benchmark.');
      writeFileSync(join(directory, 'cases', `${fixture.id}.json`), JSON.stringify(result, null, 2) + '\n');
      Object.assign(record, { status: !result.enhanced ? 'no_question' : result.coverageGap ? 'fallback' : 'applied', runId: result.runId, generatedAt: result.generatedAt, selectedStrategyId: result.strategy?.id || null, baseline: result.baseline.message, enhanced: result.enhanced?.message || null, coverageGap: result.coverageGap || null, traceFile: `cases/${fixture.id}.json`, callCount: result.calls.length, generationDurationMs: Date.now() - started });
      delete record.error;
      delete record.review;
      delete record.baselineMeetsScreen;
      delete record.enhancedMeetsScreen;
    }
    if (record.enhanced) {
      try {
        record.review = await request('/api/developer/question-review', { caseId: fixture.id, baseline: record.baseline, enhanced: record.enhanced }, 180000);
        record.baselineMeetsScreen = meetsScreen(record.review.questions.baseline);
        record.enhancedMeetsScreen = meetsScreen(record.review.questions.enhanced);
        delete record.reviewError;
      } catch (error) { record.reviewError = error.message; }
    }
    record.attempts.push({ finishedAt: new Date().toISOString(), durationMs: Date.now() - started, status: record.status, reviewError: record.reviewError || null });
  } catch (error) {
    record.status = 'error'; record.error = error.message;
    record.attempts.push({ finishedAt: new Date().toISOString(), durationMs: Date.now() - started, status: 'error', error: error.message });
  }
  checkpoint();
  console.log(`${record.status}: ${fixture.id}${record.review ? `; blind scores ${record.review.questions.baseline.total}/${record.review.questions.enhanced.total}; preference ${record.review.preference}` : ''}${record.error || record.reviewError ? `; ${record.error || record.reviewError}` : ''}`);
}
const requested = cases.slice(0, limit);
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => { while (next < requested.length) await evaluate(requested[next++]); }));
checkpoint();
console.log(JSON.stringify(saved.summary));
