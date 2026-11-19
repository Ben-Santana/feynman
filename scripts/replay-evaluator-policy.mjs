// Live evaluator screening with synthetic transcripts and a connected account.
// Pass --advanced for the Apply and Analyze transfer experiment.
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';
import { evaluateRefined } from '../backend/src/refinedEvaluator.js';
import { chat } from '../backend/src/chat.js';

const groups = [
  ['remember', 'Ohm’s law', 'State the equation relating voltage, current, and resistance.', 'State Ohm’s law.', [
    ['V = IR', true], ['Voltage equals current times resistance.', true], ['Voltage equals current times something.', false], ['V = I/R', false],
  ]],
  ['understand', 'Ohm’s law', 'Explain direct proportionality between voltage and current at fixed resistance.', 'How does current change as voltage changes when resistance stays the same?', [
    ['Current is directly proportional to voltage at fixed resistance.', true], ['If resistance stays the same, doubling voltage doubles current.', true], ['More voltage means more current.', false], ['Doubling voltage halves current at fixed resistance.', false],
  ]],
  ['understand', 'Natural selection', 'Explain how heritable variation and differences in reproduction change a population over generations.', 'Why can a population change through natural selection?', [
    ['Heritable variants associated with higher reproductive success increase in frequency over generations.', true],
    ['If some animals have a trait they can pass down and it helps them leave more offspring, more of the animals will have it after many generations.', true],
    ['Some animals leave more offspring.', false], ['Each animal changes its inherited traits when it needs to survive.', false],
  ]],
];

const advanced = [
  {
    level: 'apply', learningType: 'quantitative', topic: 'Average speed',
    aspect: 'Calculate average speed from total distance and elapsed time and explain the method.',
    question: 'A runner covers 120 m in 20 s. Calculate their average speed and explain your method.',
    answer: 'Average speed is total distance divided by elapsed time, so 120 m / 20 s = 6 m/s.',
    hint: 'Divide the total distance, 120 m, by 20 s to get 6 m/s. Explain how to find the speed.',
  },
  {
    level: 'analyze', learningType: 'experimental', topic: 'Seed germination',
    aspect: 'Explain why temperature and light effects cannot be separated and propose a comparison to isolate temperature.',
    question: 'A temperature-only model predicts 18 of 20 seeds germinate at 25 °C and 12 of 20 at 15 °C after one week. Simulated results were 16 of 20 in a bright box at 25 °C and 6 of 20 in a dark box at 15 °C. Compare the pattern and discrepancies with the prediction, distinguish what the data show from possible explanations, and propose a comparison to isolate temperature.',
    answer: 'The warm bright box had more germination, matching the predicted direction, but both counts were lower than predicted and the observed gap was 10 seeds versus 6 predicted. Light could contribute to the larger gap, or the difference could reflect sampling variation. The results alone do not isolate temperature because light changed too. Randomly assign seeds from the same batch to replicated boxes, hold light and other conditions fixed, and compare germination at 15 °C and 25 °C after a week.',
    hint: 'The warm bright box had more germination, matching the predicted direction, but both counts were lower than predicted and the observed gap was 10 seeds versus 6 predicted. Light or sampling variation could explain the larger gap. The temperature effect is confounded with light. To isolate it, randomly assign seeds from the same batch to replicated boxes, hold light and other conditions fixed, and compare germination at 15 °C and 25 °C after a week. Explain those results and the proposed comparison.',
  },
];

async function replayAdvanced(query) {
  for (const { level, learningType, topic, aspect, question, answer, hint } of advanced) {
    if (process.argv.includes('--analyze-only') && level !== 'analyze') continue;
    for (const assisted of [false, true]) {
      for (const requireTransfer of [true, false]) {
        if (process.argv.includes('--analyze-only') && requireTransfer) continue;
        const messages = [{ role: 'assistant', content: assisted ? question + '\n' + hint : question }, { role: 'user', content: answer }];
        const result = await evaluateRefined({ level, learningType, topic, aspects: [aspect], messages }, query, undefined, { requireTransfer, requireIndependent: true });
        const expected = !assisted && !requireTransfer;
        const eligible = result.completion.eligible;
        console.log(JSON.stringify({ level, topic, assisted, requireTransfer, expected, eligible, blockers: result.completion.blockers, next: result.nextEvidenceObjective }));
        if (eligible !== expected) process.exitCode = 1;
      }
    }
  }
}

async function replayChat(query) {
  for (const { level, learningType, topic, aspect, question, answer, hint } of advanced) {
    for (const assisted of [false, true]) {
      const messages = [{ role: 'assistant', content: assisted ? question + '\n' + hint : question }, { role: 'user', content: answer }];
      const result = await chat({ level, learningType, topic, aspects: [aspect], messages }, query);
      const complete = result.assessment?.complete;
      console.log(JSON.stringify({ level, assisted, complete, message: result.message, blockers: result.assessment?.refined?.completion.blockers }));
      if (complete !== !assisted || (assisted && !result.assessment?.refined?.completion.blockers.some(({ code }) => code === 'independent_check_needed'))) process.exitCode = 1;
    }
  }
  const { level, learningType, topic, aspect, question, answer } = advanced[0];
  const transfer = 'Also apply the method to a trip with a stationary interval and explain how the interval affects the average.';
  const result = await chat({ level, learningType, topic, aspects: [aspect, transfer], messages: [{ role: 'assistant', content: question }, { role: 'user', content: answer }] }, query);
  console.log(JSON.stringify({ explicitTransfer: true, complete: result.assessment?.complete, message: result.message, criteria: result.assessment?.criteria }));
  if (result.assessment?.complete !== false || result.assessment.criteria[1].status === 'supported') process.exitCode = 1;
}

async function replayCompletion(query) {
  const followUps = [
    [
      'A cyclist travels 150 m in 30 s. How would you calculate their average speed and explain what that speed means for this trip?',
      'I divide the full distance by elapsed time: 150 m / 30 s = 5 m/s. The cyclist covered 5 meters per second on average, even if their speed varied.',
    ],
    [
      'Here is a fresh simulated one-week trial with matched seed batches and water. The model predicts 18 of 20 germinate at 25 °C and 12 of 20 at 15 °C. The 25 °C dark box had 14 germinations, the 15 °C bright box had 9, and an additional 15 °C dark box had 13. How does the additional box affect what you can conclude about temperature?',
      'Comparing the 25 °C dark box with the 15 °C bright box gives a gap of 5, but that mixes changes in temperature and light. The added dark box lets us compare 14 with 13 at the same light level. That one-seed difference is in the predicted direction, but is much smaller than the six-seed prediction. The two cold boxes differ by four seeds, so light could contribute to the original gap. I would repeat the same-light comparison with replicated boxes to see whether the one-seed gap persists beyond sampling variation.',
    ],
  ];
  const cases = advanced.map(({ level, learningType, topic, aspect, question, hint, answer }, index) => ({
    label: level,
    input: { level, learningType, topic, aspects: [aspect], messages: [
      { role: 'assistant', content: question + '\n' + hint }, { role: 'user', content: answer },
      { role: 'assistant', content: followUps[index][0] }, { role: 'user', content: followUps[index][1] },
    ] },
  }));
  const { level, learningType, topic, aspect, question, answer } = advanced[0];
  cases.push({
    label: 'explicit transfer',
    input: { level, learningType, topic, aspects: [aspect, 'Also apply the method to a trip with a stationary interval and explain how the interval affects the average.'], messages: [
      { role: 'assistant', content: question }, { role: 'user', content: answer },
      { role: 'assistant', content: 'If the runner covers the same 120 m in 20 s, then stands still for 10 s before the trip ends, what is their average speed for the whole trip?' },
      { role: 'user', content: 'The stop adds 10 s without adding any distance. Over the whole trip the average is 120 m / 30 s = 4 m/s, lower than the 6 m/s while moving because the same distance took longer.' },
    ] },
  });
  for (const { label, input } of cases) {
    const result = await chat(input, query);
    const complete = result.assessment?.complete;
    console.log(JSON.stringify({ label, complete, message: result.message, blockers: result.assessment?.refined?.completion.blockers }));
    if (complete !== true) process.exitCode = 1;
  }
}

const runtime = createChatGPT();
try {
  const accounts = runtime.accounts().filter(account => account.connected);
  if (accounts.length !== 1) throw new Error('Requires one unambiguous connected ChatGPT account.');
  const provider = new ChatGPTProvider({ runtime, accountId: accounts[0].id });
  provider.model = process.argv.slice(2).find(arg => !arg.startsWith('--')) || (await provider.listModels())[0]?.slug;
  if (!provider.model) throw new Error('No ChatGPT model available.');
  console.log('Model', provider.model);
  const query = createProviderQuery(provider);
  if (process.argv.includes('--complete')) await replayCompletion(query);
  else if (process.argv.includes('--chat')) await replayChat(query);
  else if (process.argv.includes('--advanced')) await replayAdvanced(query);
  else for (const [level, topic, aspect, question, answers] of groups) {
    for (const [answer, expected] of answers) {
      for (const baseline of [true, false]) {
        const input = { level, topic, aspects: [aspect], messages: [{ role: 'assistant', content: question }, { role: 'user', content: answer }] };
        const result = await evaluateRefined(input, (system, ...args) => query(
          baseline ? system.replace(/\nGrade the scientific meaning\.[^\n]+/, '') : system,
          ...args,
        ));
        const eligible = result.completion.eligible;
        console.log(JSON.stringify({ level, topic, answer, baseline, expected, eligible, blockers: result.completion.blockers, next: result.nextEvidenceObjective }));
        if (!baseline && eligible !== expected) process.exitCode = 1;
      }
    }
  }
} finally {
  await runtime.close?.();
}
