import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';
import { chat } from '../backend/src/chat.js';
import { comparisonCases } from '../backend/src/questionStrategies.js';
import { conversationAssessment, evaluateRefined } from '../backend/src/refinedEvaluator.js';

const shortlistIds = [
  'coverage-recall-specific-element-remember',
  'coverage-remove-condition-understand',
  'coverage-controlled-comparison-apply',
  'coverage-necessary-sufficient-analyze',
  'coverage-representation-change-understand',
];
const fixtures = shortlistIds.map(id => comparisonCases.find(item => item.id === id));
const repeats = Number(process.argv[3] || 1);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw new Error('Use 1–5 repeats.');
const output = new URL(repeats === 1 ? '../output/strategy-shortlist-replay.json' : '../output/strategy-shortlist-repeated.json', import.meta.url);
mkdirSync(new URL('.', output), { recursive: true });
const runtime = createChatGPT();
const report = { repeats, variable: 'strategy catalog', method: 'Live paired screening. Freeze one evaluator result per transcript across all repeats. Alternate which branch goes first across cases and repeats. Measure serialized response requests and elapsed chat time after grading. Record provider usage when available. Authored evidence targets are used for manual review.', runs: [] };
try {
  const accounts = runtime.accounts().filter(a => a.connected);
  if (accounts.length !== 1) throw new Error('Requires one unambiguous connected ChatGPT account.');
  const provider = new ChatGPTProvider({ runtime, accountId: accounts[0].id });
  provider.model = process.argv[2] || (await provider.listModels())[0].slug;
  report.model = provider.model;
  const query = createProviderQuery(provider);
  for (const [index, fixture] of fixtures.entries()) {
    const { id } = fixture;
    const input = structuredClone(Object.fromEntries(['topic', 'level', 'learningType', 'aspects', 'messages'].map(k => [k, fixture[k]])));
    const evaluation = await evaluateRefined(input, query, undefined, { requireIndependent: ['apply', 'analyze'].includes(input.level) });
    const assessment = conversationAssessment(evaluation, input);
    const run = { id, input, assessment, branches: [] };
    report.runs.push(run);
    const variant = 'shortlist';
    for (let repeat = 1; repeat <= repeats; repeat++) for (const branch of (index + repeat - 1) % 2 ? [variant, 'full'] : ['full', variant]) {
      const calls = [];
      const started = performance.now();
      const record = { repeat, branch, calls };
      run.branches.push(record);
      try {
        const result = await chat(input, async (instructions, messages, response, options) => {
          if (response.name !== 'reply_to_teacher') throw new Error('Expected a reply with the frozen assessment.');
          const call = {
            bytes: Buffer.byteLength(JSON.stringify({ instructions, messages, response })),
            messageCount: messages.length,
            strategies: response.schema.properties.strategyChoice?.properties.strategyId.enum.filter(id => id !== 'none') || [],
          };
          calls.push(call);
          return query(instructions, messages, response, { ...options, onUsage: ({ usage }) => {
            if (usage) call.usage = {
              inputTokens: usage.input_tokens,
              cachedTokens: usage.input_tokens_details?.cached_tokens,
              outputTokens: usage.output_tokens,
              reasoningTokens: usage.output_tokens_details?.reasoning_tokens,
            };
          } });
        }, undefined, {
          strategyCatalog: branch,
          persistedAssessment: assessment,
        });
        record.question = result.message;
        record.selected = result.learnerModel?.strategyId;
      } catch (error) {
        record.error = error.message;
        process.exitCode = 1;
      }
      record.elapsedMs = Math.round(performance.now() - started);
      record.retries = Math.max(0, calls.length - 1);
      writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({ id, objective: assessment.nextQuestionFocus, ...record }));
    }
  }
} finally {
  runtime.close();
}
