// Opt-in live screening through the existing local API. Never starts the project.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { evaluatorTestCases, evaluatorSuiteVersion, screenEvaluatorComparison, summarizeEvaluatorScreens, summarizeEvaluatorComparisons } from '../backend/src/evaluatorBenchmark.js';
import { evaluatorVersion } from '../backend/src/evaluatorContracts.js';
import { comparisonOptions } from '../backend/src/evaluatorComparison.js';

const argument = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
if (process.argv.includes('--list')) {
  const listed = evaluatorTestCases.filter(c => !process.argv.includes('--challenges') || c.tags.includes('challenge'));
  for (const c of listed) console.log(`${c.id} | ${c.input.learningType}/${c.input.level} | ${c.expected.eligible ? 'completion expected' : 'more evidence expected'} | ${c.tags.join(', ')}`);
  console.log(`${listed.length} authored screening cases; not professor-scored benchmarks.`);
  process.exit(0);
}
const provider = argument('--provider');
const evaluationOptions = comparisonOptions({ mode: argument('--mode'), shadow: process.argv.includes('--shadow') });
if (!provider || provider.startsWith('--')) throw new Error('Select --provider explicitly (chatgpt or anthropic). Use --list to inspect cases without model calls.');
const base = process.env.FEYNMAN_API_ORIGIN || 'http://127.0.0.1:3001';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw new Error('Evaluator developer screening requires a local API origin.');
const repeats = Number(argument('--repeats') || 1);
const limit = Number(argument('--limit') || evaluatorTestCases.length);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5 || !Number.isInteger(limit) || limit < 1) throw new Error('Use repeats 1–5 and a positive integer limit.');
const selectedIds = argument('--case-ids')?.split(',');
if (selectedIds?.some(id => !evaluatorTestCases.some(c => c.id === id))) throw new Error('Unknown case ID; use --list.');
const cases = evaluatorTestCases.filter(c => (!process.argv.includes('--challenges') || c.tags.includes('challenge')) && (!selectedIds || selectedIds.includes(c.id))).slice(0, limit);
const headers = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Feynman-Provider': provider };
const modelSelection = argument('--model');
if (modelSelection) headers['X-Feynman-Model'] = modelSelection;
const account = argument('--account');
if (account) headers['X-Feynman-Account'] = account;
const abort = new AbortController();
process.once('SIGINT', () => abort.abort());
async function request(path, body, timeout = 210000) {
  let response;
  try { response = await fetch(base + path, { headers, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(timeout)]), ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) }); }
  catch (error) { if (abort.signal.aborted) throw error; throw new Error(`Cannot reach the local evaluator API. Start it yourself before a live run. ${error.message}`); }
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || 'Request failed'}`);
  return { data, response };
}
const access = await request('/api/access', { code: process.env.FEYNMAN_ACCESS_CODE || '6767' }, 10000);
const cookie = access.response.headers.get('set-cookie');
if (!cookie) throw new Error('The local API did not issue an access session.');
headers.Cookie = cookie.split(';')[0];
const health = (await request('/api/health', undefined, 10000)).data;
if (!health.configured) throw new Error('Configure the explicitly selected provider before running live screening.');
if ((await request('/api/developer/evaluator-comparison', undefined, 10000)).data.evaluatorVersion !== evaluatorVersion) throw new Error('The running backend has an older evaluator. Restart it yourself before screening.');
const model = modelSelection || (provider === 'chatgpt' ? (await request('/api/ai/models', undefined, 15000)).data.models[0]?.slug : health.model);
if (!model) throw new Error('No selected model is available.');
headers['X-Feynman-Model'] = model;
const promptVersion = (await request('/api/developer/prompts', undefined, 10000)).data.version;
const sourceFiles = ['backend/src/evaluatorContracts.js', 'backend/src/evaluatorLean.js', 'backend/src/evaluatorComparison.js', 'backend/src/chat.js', 'backend/src/evaluatorTestCases.js', 'backend/src/evaluatorChallengeCases.js', 'backend/src/evaluatorBorderlineCases.js', 'backend/src/evaluatorLongCases.js', 'backend/src/evaluatorFixtures.js', 'backend/src/evaluatorBenchmark.js', 'frontend/src/learningTypes.js'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const identity = { suiteVersion: evaluatorSuiteVersion, provider, model, promptVersion, sourceHashes, evaluationOptions, cases, repeats };
const fingerprint = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
const directory = resolve(argument('--output') || `backend/evaluations/evaluator-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`);
mkdirSync(join(directory, 'runs'), { recursive: true });
const checkpointPath = join(directory, 'results.json');
let report = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : { schemaVersion: 1, ...identity, fingerprint, startedAt: new Date().toISOString(), limitation: 'Author-specified screening expectations, not expert-scored correctness or evidence of educational validity. Expected labels are never sent to the models.', records: [] };
if (report.fingerprint !== fingerprint) throw new Error('Cases, provider/model, prompts, or sources changed. Use a new output directory rather than overwriting an earlier run.');
const persist = () => { report.updatedAt = new Date().toISOString(); report.summary = summarizeEvaluatorScreens(report.records); report.comparisonSummary = summarizeEvaluatorComparisons(report.records); writeFileSync(checkpointPath, JSON.stringify(report, null, 2) + '\n'); };
persist();
for (let repeat = 1; repeat <= repeats; repeat++) for (const c of cases) {
  abort.signal.throwIfAborted();
  const key = `${c.id}-${repeat}`;
  if (report.records.some(r => r.key === key && r.status === 'completed')) continue;
  console.log(`Assessing ${key} (${c.input.level}, ${c.input.learningType})`);
  const started = Date.now();
  let record;
  try {
    // Deliberately send input only: no expected outcome, tags, or author rationale.
    const run = (await request('/api/developer/evaluator-comparison', { ...c.input, ...evaluationOptions })).data;
    if (run.provider !== provider || run.model !== model || run.promptVersion !== promptVersion) throw new Error('Provider/model or saved prompts changed during the run.');
    writeFileSync(join(directory, 'runs', `${key}.json`), JSON.stringify(run, null, 2) + '\n');
    record = { key, caseId: c.id, repeat, status: 'completed', durationMs: Date.now() - started, ...screenEvaluatorComparison(c, run), traceFile: `runs/${key}.json` };
    console.log(`  existing: ${record.legacy.status}; refined: ${record.refined.status}; shadow: ${run.shadow.status}`);
  } catch (error) {
    if (abort.signal.aborted) { persist(); throw error; }
    record = { key, caseId: c.id, repeat, status: 'error', durationMs: Date.now() - started, legacy: { status: 'error', error: error.message }, refined: { status: 'error', error: error.message } };
    console.error(`  ${error.message}`);
  }
  report.records = [...report.records.filter(r => r.key !== key), record]; persist();
}
console.log(JSON.stringify(report.summary, null, 2));
console.log(JSON.stringify(report.comparisonSummary, null, 2));
console.log(`Saved report: ${checkpointPath}`);
if (Object.values(report.summary).some(s => s.mismatched || s.errors || s.abstentions)) process.exitCode = 1;
