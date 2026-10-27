import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';
import { createEvaluationContext } from '../backend/src/evaluatorContracts.js';
import { evaluatorMaterial, evaluateRefined } from '../backend/src/refinedEvaluator.js';
import { normalizePrimaryAssessment } from '../backend/src/evaluatorPrimary.js';
import { loadPrompts } from '../backend/src/promptStore.js';

// Two actual evaluator calls on the same frozen, user-authorized local test.
// Runtime handles existing credentials; never serialize account/token objects.
const root = new URL('../output/', import.meta.url);
mkdirSync(root, { recursive: true });
const before = JSON.parse(readFileSync(new URL('../backend/fixtures/workshop-latency-before.json', import.meta.url), 'utf8'));
const runtime = createChatGPT();
const accounts = runtime.accounts().filter(a => a.connected);
if (accounts.length !== 1) throw new Error('Benchmark requires one unambiguous connected ChatGPT account.');
const provider = new ChatGPTProvider({ runtime, accountId: accounts[0].id });
const models = await provider.listModels();
provider.model = models[0].slug;
const query = createProviderQuery(provider);
const context = createEvaluationContext(before.input, { requireTransfer: true });
const material = evaluatorMaterial(context, loadPrompts());
const report = { model: provider.model, method: 'One sequential before/after pair on identical saved transcript; no retry, no cache. Not a statistical latency estimate.', runs: [] };
function save() { writeFileSync(new URL('workshop-latency-comparison.json', root), JSON.stringify(report, null, 2)); }
for (const version of ['before', 'after']) {
  const requests = [];
  let raw;
  const started = performance.now();
  try {
    const traced = async (instructions, messages, response, options) => {
      requests.push({ instructions, messages, response });
      raw = await query(instructions, messages, response, options);
      return raw;
    };
    const result = version === 'before'
      ? normalizePrimaryAssessment(await traced(before.instructions, before.messages, before.response), context, material.task)
      : await evaluateRefined(before.input, traced, loadPrompts(), { requireTransfer: true });
    report.runs.push({ version, durationMs: Math.round(performance.now() - started), calls: requests.length, requestBytes: requests.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r)), 0), responseBytes: Buffer.byteLength(JSON.stringify(raw)), result });
  } catch (error) { report.runs.push({ version, durationMs: Math.round(performance.now() - started), error: error.message }); save(); throw error; }
  save();
  console.log(JSON.stringify({ version, ...Object.fromEntries(Object.entries(report.runs.at(-1)).filter(([key]) => key !== 'result')), complete: report.runs.at(-1).result.completion.eligible }));
}
runtime.close();
