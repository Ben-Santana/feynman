// Generate once through the same endpoint as Chat playground's Generate items.
// Successful cases are checkpointed; rerunning resumes rather than regenerating.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';

const base = process.env.FEYNMAN_API_ORIGIN || 'http://127.0.0.1:3001';
const output = new URL('../backend/comparison-rubrics.json', import.meta.url);
const provider = process.env.FEYNMAN_RUBRIC_PROVIDER || 'chatgpt';
const model = process.env.FEYNMAN_RUBRIC_MODEL || '';
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const caseId = argument('--case-id');
const topic = argument('--topic');
if (Boolean(caseId) !== Boolean(topic)) throw new Error('Provide both --case-id and --topic to generate a rubric for a new fixture.');
if (caseId && (!/^[a-z0-9-]+$/.test(caseId) || !topic.trim())) throw new Error('Use a valid case ID and nonempty topic.');
const suite = argument('--suite');
if (suite && suite !== 'coverage') throw new Error('Choose --suite coverage or omit --suite for all fixtures.');
const fixtures = caseId ? [{ id: caseId, topic, level: argument('--level') || 'understand', learningType: argument('--learning-type') || 'quantitative' }]
  : suite === 'coverage' ? JSON.parse(readFileSync(new URL('../backend/strategy-comparison-cases.json', import.meta.url), 'utf8')).cases
    : (await import('../backend/src/questionStrategies.js')).comparisonCases;
const concurrency = Number(argument('--concurrency') || 1);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new Error('Use concurrency 1–3.');
const headers = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Feynman-Provider': provider, ...(model ? { 'X-Feynman-Model': model } : {}) };
async function request(path, body) {
  const response = await fetch(base + path, { headers, signal: AbortSignal.timeout(200000), ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
const unlocked = await fetch(base + '/api/access', { method: 'POST', headers, body: JSON.stringify({ code: '6767' }) });
if (!unlocked.ok) throw new Error('Could not unlock the local API.');
headers.Cookie = unlocked.headers.get('set-cookie').split(';')[0];
const health = await request('/api/health');
if (!health.configured) throw new Error('Configure the selected provider before generating rubrics.');
const resolvedModel = model || (provider === 'chatgpt' ? (await request('/api/ai/models')).models[0]?.slug : health.model);
if (resolvedModel) headers['X-Feynman-Model'] = resolvedModel;
const { version: promptVersion } = await request('/api/developer/prompts');
const saved = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { version: 1, cases: {} };
async function generate(fixture) {
  const input = { topic: fixture.topic, level: fixture.level, learningType: fixture.learningType };
  if (saved.cases[fixture.id] && !process.argv.includes('--force')) {
    if (JSON.stringify(saved.cases[fixture.id].input) !== JSON.stringify(input)) throw new Error(`Saved input changed for ${fixture.id}; use --force to regenerate.`);
    console.log(`Saved already: ${fixture.id}`); return;
  }
  console.log(`Generating ${fixture.id} (${input.level})...`);
  const result = await request('/api/developer/rubric', input);
  if ((await request('/api/developer/prompts')).version !== promptVersion) throw new Error('Prompts changed during generation; stop and review before resuming.');
  if (!Array.isArray(result.items) || !result.items.length || result.items.some(item => typeof item !== 'string' || !item.trim())) throw new Error(`Invalid rubric for ${fixture.id}`);
  saved.cases[fixture.id] = { input, items: result.items, generatedAt: new Date().toISOString(), provider, model: resolvedModel || health.model, promptVersion, pipeline: 'generateLevelRubric', endpoint: '/api/developer/rubric' };
  const temporary = new URL('../backend/comparison-rubrics.json.tmp', import.meta.url);
  writeFileSync(temporary, JSON.stringify(saved, null, 2) + '\n');
  renameSync(temporary, output);
  console.log(`Saved ${fixture.id}: ${result.items.length} rubric items.`);
}
let next = 0;
const workers = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
  while (next < fixtures.length) await generate(fixtures[next++]);
}));
const failure = workers.find(result => result.status === 'rejected');
if (failure) throw failure.reason;
console.log(`All ${fixtures.length} requested rubrics saved.`);
