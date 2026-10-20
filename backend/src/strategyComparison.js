import { generateStrategyQuestion } from './strategyLearner.js';
import { chat } from './chat.js';
import { loadPrompts } from './promptStore.js';
import { comparisonCases, corpusVersion } from './questionStrategies.js';

export async function compareQuestions(caseId, query, prompts = loadPrompts(), { catalog } = {}) {
  const selected = comparisonCases.find(item => item.id === caseId);
  if (!selected) throw new Error('Choose a valid comparison case.');
  // Keep benchmark expectations, review guides, and strategy-bearing titles out
  // of both branches and the diagnostic evaluator.
  const input = structuredClone({ topic: selected.topic, level: selected.level, learningType: selected.learningType, aspects: selected.aspects, messages: selected.messages });
  const comparisonMode = selected.comparisonMode || 'open';
  const intendedStrategyId = selected.expectedStrategyId || null;
  const calls = [];
  const traced = branch => async (instructions, messages, response, options) => {
    const call = { branch, name: response.name, request: { instructions, messages, response }, durationMs: 0 };
    calls.push(call);
    const started = Date.now();
    try { const result = await query(instructions, messages, response, options); call.response = result; return result; }
    catch (error) { call.error = error.message; throw error; }
    finally { call.durationMs = Date.now() - started; }
  };
  let generation;
  const baseline = await chat(input, async (instructions, messages, response, options) => {
    if (response.name === 'respond_to_student') generation = { instructions, messages, response };
    return traced(response.name === 'evaluate_learning' ? 'shared rubric evaluator' : 'default learner')(instructions, messages, response, options);
  }, prompts, { evaluator: 'legacy', learner: 'default' });
  if (!generation) return { case: selected, corpusVersion, promptVersion: prompts.version, comparisonMode, intendedStrategyId, baseline, enhanced: null, calls, notice: 'The shared evaluator completed this case, so no next question was generated.' };
  const generated = await generateStrategyQuestion(input, baseline, generation, query, { catalog, comparisonMode, intendedStrategyId, caseId, trace: traced });
  return { ...generated, case: selected, corpusVersion, promptVersion: prompts.version, calls: [...calls, ...generated.calls] };
}
