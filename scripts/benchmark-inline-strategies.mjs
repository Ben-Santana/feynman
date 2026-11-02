import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';
import { chat } from '../backend/src/chat.js';
import { comparisonCases } from '../backend/src/questionStrategies.js';
import { inlineQuestionStrategies } from '../backend/src/inlineQuestionStrategies.js';

const ids = [
  'coverage-recall-specific-element-remember',
  'coverage-remove-condition-understand',
  'coverage-controlled-comparison-apply',
  'coverage-necessary-sufficient-analyze',
  'coverage-representation-change-understand',
];
const output = new URL('../output/inline-strategies-live-2026-11-02.json', import.meta.url);
mkdirSync(new URL('../output/', import.meta.url), { recursive: true });
const runtime = createChatGPT();
const report = { startedAt: new Date().toISOString(), method: 'Five sequential fixed transcripts. Inline branch runs ordinary chat with fresh live evaluation and response. Control replays that exact evaluator response locally and removes only the inline catalog instructions and choice schema from the live response request. Its total is projected using the measured evaluator time. Inline always precedes control, so cache/order/load effects confound latency. No forced strategy IDs or benchmark labels are sent. No live independent reviewer.', runs: [] };
const save = () => writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
try {
  const accounts = runtime.accounts().filter(a => a.connected);
  if (accounts.length !== 1) throw new Error('Requires one unambiguous connected ChatGPT account.');
  const provider = new ChatGPTProvider({ runtime, accountId: accounts[0].id });
  provider.model = (await provider.listModels())[0].slug;
  report.model = provider.model;
  const query = createProviderQuery(provider);
  for (const id of ids) {
    const fixture = comparisonCases.find(c => c.id === id);
    const input = structuredClone(Object.fromEntries(['topic', 'level', 'learningType', 'aspects', 'messages'].map(k => [k, fixture[k]])));
    const run = { caseId: id, input, branches: [] };
    report.runs.push(run);
    let evaluation;
    let evaluatorMs = 0;
    for (const branch of ['inline', 'control']) {
      const record = { branch, calls: [] };
      run.branches.push(record);
      const started = performance.now();
      try {
        const traced = async (instructions, messages, response, options) => {
          if (branch === 'control' && response.name === 'evaluate_refined') {
            if (!evaluation) throw new Error('No evaluator result available to replay.');
            return structuredClone(evaluation);
          }
          if (branch === 'control' && response.name === 'respond_to_student') {
            instructions = instructions.replace(inlineQuestionStrategies(input).instructions, '');
            response = structuredClone(response);
            delete response.schema.properties.strategyChoice;
            response.schema.required = response.schema.required.filter(k => k !== 'strategyChoice');
          }
          const call = { name: response.name, requestBytes: Buffer.byteLength(JSON.stringify({ instructions, messages, response })), request: { instructions, messages, response } };
          record.calls.push(call);
          const callStart = performance.now();
          try {
            const result = await query(instructions, messages, response, options);
            call.response = structuredClone(result);
            if (response.name === 'evaluate_refined') evaluation = structuredClone(result);
            return branch === 'control' && response.name === 'respond_to_student' ? { ...result, strategyChoice: { strategyId: 'none', rationale: 'Benchmark control omits catalog selection.', targetQuote: '', rubricItem: '' } } : result;
          } catch (error) { call.error = error.message; throw error; }
          finally {
            call.durationMs = Math.round(performance.now() - callStart);
            if (response.name === 'evaluate_refined') evaluatorMs += call.durationMs;
          }
        };
        const result = await chat(input, traced);
        record.question = result.message;
        record.assessmentComplete = result.assessment?.complete;
        record.strategy = branch === 'inline' ? result.learnerModel : null;
      } catch (error) { record.error = error.message; }
      record.elapsedMs = Math.round(performance.now() - started);
      record.evaluatorMs = branch === 'inline' ? evaluatorMs : 0;
      record.responseMs = record.calls.filter(c => c.name === 'respond_to_student').reduce((n, c) => n + c.durationMs, 0);
      if (branch === 'control') record.projectedTotalMs = evaluatorMs + record.elapsedMs;
      save();
      console.log(JSON.stringify({ caseId: id, branch, model: report.model, elapsedMs: record.elapsedMs, responseMs: record.responseMs, projectedTotalMs: record.projectedTotalMs, calls: record.calls.length, strategyId: record.strategy?.strategyId, question: record.question, error: record.error }));
    }
  }
} finally { report.finishedAt = new Date().toISOString(); save(); runtime.close(); }
