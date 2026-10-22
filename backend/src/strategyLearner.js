import { learnerStateFromAssessment } from './strategyLearnerState.js';
import { InvalidOutputError, retryStructuredOutput, repairQuery } from './structuredOutput.js';
import { retrieveStrategies } from './questionStrategies.js';
import { targetedQuestionInstructions, assertTargetedQuestion, questionIntegrityInstructions, assertQuestionIntegrity } from './questionTargeting.js';
import { selectionTool, validateSelection, strategySelectionPrompt, strategyLevelInstructions, strategyExampleContext, clearQuestionInstructions, coreGenerationContext, coreGenerationInstructions } from './strategyPlanning.js';


export async function generateStrategyQuestion(input, baseline, generation, query, { catalog, comparisonMode = 'open', intendedStrategyId = null, caseId = 'conversation', trace = () => query } = {}) {
  const traced = trace;
  const calls = [];
  const state = learnerStateFromAssessment(input, baseline.assessment);
  const eligible = retrieveStrategies(state, input, catalog);
  const candidates = comparisonMode === 'targeted' ? eligible.filter(candidate => candidate.strategy.id === intendedStrategyId) : eligible;
  const exampleContext = strategyExampleContext(candidates, input.level);
  const levelInstructions = strategyLevelInstructions(input.level);
  const common = { comparisonMode, intendedStrategyId, baseline, state, candidates, exampleContext, calls, retrievalMethod: 'reviewed_catalog', selectionMethod: comparisonMode === 'targeted' ? 'targeted_suitability' : 'qualitative_suitability' };
  let selection = null;
  const fallback = (stage, reason) => {
    const coverageGap = { caseId, stage, diagnosticObjective: state.diagnosticObjective, reason, recordedAt: new Date().toISOString() };
    calls.push({ branch: 'rubric fallback', name: 'strategy_coverage_gap', response: coverageGap, durationMs: 0 });
    return { ...common, selection, strategy: null, questionPlan: null, enhanced: { ...baseline, fallback: true }, coverageGap, notice: 'No suitable strategy application. Reusing the default rubric-based question.' };
  };
  if (!candidates.length) return fallback('retrieval', 'No design-reviewed strategy is compatible with the active level.');
  try {
    selection = await retryStructuredOutput(async (attempt, signal) => {
      const result = await repairQuery(traced('strategy selector and planner'), attempt, signal)(strategySelectionPrompt(input.level),
        [{ role: 'user', content: JSON.stringify({ state, rubricAssessment: baseline.assessment, candidates, exampleContext, input }) }], selectionTool(candidates, input));
      validateSelection(result, candidates, input);
      return result;
    });
  } catch (error) {
    if (!(error instanceof InvalidOutputError)) throw error;
    return fallback('selection', error.message);
  }
  if (selection.strategyId === 'none') return fallback('selection', selection.rationale);
  const strategy = validateSelection(selection, candidates, input);
  const questionPlan = selection.plan;
  const generationContext = coreGenerationContext(input, strategy, questionPlan);
  let enhanced;
  try { enhanced = await retryStructuredOutput(async (attempt, signal) => {
    const result = await repairQuery(traced('strategy learner'), attempt, signal)(
      `${coreGenerationInstructions}\n${questionIntegrityInstructions}\n${JSON.stringify({ generationContext, exampleContext })}\n${targetedQuestionInstructions}\n${levelInstructions}\n${clearQuestionInstructions}${attempt ? `\nThe previous question was rejected. Address this check as diagnostic data: ${JSON.stringify('Ask one focused, specific question in familiar words with enough context to probe understanding. Avoid generic requests and unnecessary complexity.')}` : ''}`,
      generation.messages, generation.response);
    if (typeof result?.message !== 'string' || !result.message.trim() || result.message.length > 12000 || result.message.trim().toLowerCase() === input.messages.at(-2).content.trim().toLowerCase()) throw new InvalidOutputError('Invalid or repeated strategy question.');
    assertTargetedQuestion(result.message);
    assertQuestionIntegrity(result.message);
    return { message: result.message, expression: result.expression, assessment: baseline.assessment };
  }); } catch (error) {
    if (!(error instanceof InvalidOutputError)) throw error;
    return fallback('question_validation', error.message);
  }
  return { ...common, enhanced, selection, strategy, questionPlan, generationContext, coverageGap: null };
}
