import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';
import { chat } from '../backend/src/chat.js';
import { comparisonCases } from '../backend/src/questionStrategies.js';

const directory = new URL('../output/', import.meta.url);
mkdirSync(directory, { recursive: true });
const filename = process.argv[2] || 'background-strategy-live-2026-11-02.json';
if (!/^background-strategy-live-[a-zA-Z0-9-]+\.json$/.test(filename)) throw new Error('Use a background-strategy-live-*.json filename.');
const output = new URL(filename, directory);
const cases = ['understand', 'apply', 'analyze'].map(level => {
  const c = comparisonCases.find(c => c.expectedStrategyId === 'background-knowledge-bridge' && c.level === level);
  return { id: c.id, input: Object.fromEntries(['topic', 'level', 'learningType', 'aspects', 'messages'].map(k => [k, structuredClone(c[k])])), scriptedAnswer: {
    understand: 'Acceleration depends on the net force: for fixed mass, greater net force produces greater acceleration in that direction.',
    apply: 'Momentum is mass times velocity, including the direction represented by the velocity sign.',
    analyze: 'An individual must survive long enough to reproduce in order to leave offspring; dying before reproduction prevents it from leaving those offspring.',
  }[level] };
});
cases.push({ id: 'wording-ambiguity', input: { topic: 'Constant speed', level: 'understand', learningType: 'theoretical', aspects: ['Explains constant velocity using net force and acceleration.'], messages: [{ role: 'assistant', content: 'How do you account for this object moving at constant velocity?' }, { role: 'user', content: 'I know constant velocity means no acceleration and zero net force. I do not understand what you mean by the word account in your question.' }] } });
const runtime = createChatGPT();
const report = { startedAt: new Date().toISOString(), method: 'Unforced ordinary-chat selection on three original prerequisite-gap fixtures and one wording-ambiguity contrast. If a bridge is selected, continue once with an explicitly scripted prerequisite answer. No empirical learner or learning-gain claim; no forced strategy ID or expected labels sent to the model.', runs: [] };
const save = () => writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
try {
  const accounts = runtime.accounts().filter(a => a.connected);
  if (accounts.length !== 1) throw new Error('Requires one unambiguous connected ChatGPT account.');
  const provider = new ChatGPTProvider({ runtime, accountId: accounts[0].id });
  provider.model = (await provider.listModels())[0].slug;
  report.model = provider.model;
  const query = createProviderQuery(provider);
  for (const c of cases) {
    const run = { caseId: c.id, input: c.input, turns: [] };
    report.runs.push(run);
    let input = structuredClone(c.input);
    for (let turn = 0; turn < (c.scriptedAnswer ? 2 : 1); turn++) {
      const record = { turn, calls: [] };
      run.turns.push(record);
      const start = performance.now();
      try {
        const result = await chat(input, async (instructions, messages, response, options) => {
          const call = { name: response.name, request: { instructions, messages, response } };
          record.calls.push(call);
          const started = performance.now();
          try { const value = await query(instructions, messages, response, options); call.response = structuredClone(value); return value; }
          catch (error) { call.error = error.message; throw error; }
          finally { call.durationMs = Math.round(performance.now() - started); }
        });
        record.result = result;
        if (turn === 0 && result.background?.phase === 'probe') {
          record.scriptedNextAnswer = c.scriptedAnswer;
          input = { ...input, messages: [...input.messages, { role: 'assistant', content: result.message, background: result.background }, { role: 'user', content: c.scriptedAnswer }] };
        } else break;
      } catch (error) { record.error = error.message; break; }
      finally { record.elapsedMs = Math.round(performance.now() - start); save(); console.log(JSON.stringify({ caseId: c.id, turn, elapsedMs: record.elapsedMs, calls: record.calls.length, strategyId: record.result?.learnerModel?.strategyId, phase: record.result?.background?.phase, complete: record.result?.assessment?.complete, question: record.result?.message, error: record.error })); }
    }
  }
} finally { report.finishedAt = new Date().toISOString(); save(); runtime.close(); }
