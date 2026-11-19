import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { chat } from '../backend/src/chat.js';
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';

const goals = [
  { id: 'motion:remember:1', level: 'remember', text: 'State that average speed is total distance divided by total elapsed time.' },
  { id: 'motion:understand:1', level: 'understand', text: 'Explain why equal distances do not imply equal time weights when segment speeds differ.' },
];
const question = 'A cyclist travels 12 km at 12 km/h, then 12 km at 24 km/h. Find the whole-trip average speed and explain the method. What does this tell you about weighting the speeds?';
const answer = 'Average speed is total distance divided by total elapsed time. The legs take one hour and half an hour, so 24 km divided by 1.5 hours is 16 km/h. The slower speed contributes twice as much time despite equal distances.';
const cases = [
  ['demonstrated', [{ role: 'assistant', content: question }, { role: 'user', content: answer }]],
  ['partial', [{ role: 'assistant', content: question }, { role: 'user', content: 'Distance matters, and the slower leg takes one hour.' }]],
  ['incorrect', [{ role: 'assistant', content: question }, { role: 'user', content: 'Average speed is elapsed time divided by total distance. Equal distances always make the two time weights equal.' }]],
  ['assisted', [{ role: 'assistant', content: answer, assistance: true }, { role: 'user', content: 'I see.' }, { role: 'assistant', content: question }, { role: 'user', content: answer }]],
];
const output = new URL('../output/skipped-recovery-benchmark.json', import.meta.url);
mkdirSync(new URL('.', output), { recursive: true });
const runtime = createChatGPT();
const report = { method: 'Same synthetic turns in alternating branch order. Only grading calls go to the model. The split path runs recovery calls in parallel with active grading.', runs: [] };
try {
  const accounts = runtime.accounts().filter(account => account.connected);
  if (accounts.length !== 1) throw new Error('Requires one unambiguous connected ChatGPT account.');
  const provider = new ChatGPTProvider({ runtime, accountId: accounts[0].id });
  provider.model = process.argv[2] || (await provider.listModels())[0]?.slug;
  report.model = provider.model;
  const query = createProviderQuery(provider);
  for (const [index, [id, messages]] of cases.entries()) {
    const run = { id, branches: [] };
    report.runs.push(run);
    const input = { topic: 'Average speed', level: 'apply', learningType: 'quantitative', researchScoring: true, aspects: ['Calculate and justify the whole-trip average speed for the supplied unequal-duration legs.'], messages };
    for (const mode of index % 2 ? ['combined', 'split'] : ['split', 'combined']) {
      const record = { mode, calls: [] };
      run.branches.push(record);
      const start = performance.now();
      try {
        const result = await chat(input, (instructions, history, tool, options) => {
          if (tool.name === 'reply_to_teacher') return { message: 'What elapsed time does the whole trip take?', expression: 'attentive' };
          const call = { name: tool.name, bytes: Buffer.byteLength(JSON.stringify({ instructions, history, tool })) };
          record.calls.push(call);
          return query(instructions, history, tool, { ...options, onUsage: ({ usage }) => { call.inputTokens = usage?.input_tokens; } });
        }, undefined, { skipRecoveryMode: mode, openSkips: goals });
        record.complete = result.assessment?.complete;
        record.activeStatuses = result.assessment?.refined?.judgments.map(j => j.status);
        record.recovery = result.assessment?.skipRecovery;
      } catch (error) {
        record.error = error.message;
        process.exitCode = 1;
      }
      record.elapsedMs = Math.round(performance.now() - start);
      writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({ id, ...record }));
    }
  }
} finally {
  runtime.close();
}
