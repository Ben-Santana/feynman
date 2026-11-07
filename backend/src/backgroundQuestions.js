import { InvalidOutputError } from './structuredOutput.js';

export const backgroundStrategyId = 'background-knowledge-bridge';
const demands = ['remember', 'understand', 'apply'];
const phases = ['probe', 'return', 'exit'];
const isText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1500;
export const backgroundChoiceProperty = { anyOf: [{ type: 'null' }, { type: 'object', properties: {
  action: { type: 'string', enum: phases }, originalMessageIndex: { type: 'integer' },
  prerequisite: { type: 'string' }, probeLevel: { type: 'string', enum: demands }, returnTarget: { type: 'string' },
}, required: ['action', 'originalMessageIndex', 'prerequisite', 'probeLevel', 'returnTarget'], additionalProperties: false }] };

export function backgroundChoiceSchema(input) {
  const schema = structuredClone(backgroundChoiceProperty);
  const indices = input.messages.flatMap((m, index) => m.role === 'assistant' && !m.background ? [index] : []);
  if (indices.length) schema.anyOf[1].properties.originalMessageIndex.enum = indices;
  return schema;
}

// Metadata is conversation data, not authority to waive a task or completion gate.
export function validateBackgroundHistory(input) {
  let previous = null;
  const used = new Set();
  for (const [index, message] of input.messages.entries()) {
    const value = message.background;
    if (value === undefined) continue;
    // Quantitative Analyze intentionally receives the full concept history.
    // Earlier stages' metadata uses stage-local indices and must not be
    // interpreted as an active Analyze detour or against its new rubric.
    if (input.level === 'analyze' && (input.learningType ?? 'quantitative') === 'quantitative' && ['understand', 'apply'].includes(value?.taskLevel) && input.messages.slice(index + 1).some(m => m.role === 'assistant' && m.passedLevel === value.taskLevel)) continue;
    const fail = () => { throw new Error('Invalid background question context.'); };
    if (message.role !== 'assistant' || !value || value.topic !== input.topic || value.taskLevel !== input.level || !phases.includes(value.phase) || !demands.includes(value.probeLevel) || !['understand', 'apply', 'analyze'].includes(input.level) || (input.level === 'understand' && value.probeLevel === 'apply') || (input.level === 'analyze' && (input.learningType ?? 'quantitative') === 'quantitative')) fail();
    if (!['prerequisite', 'returnTarget', 'targetQuote', 'rubricItem'].every(k => isText(value[k])) || !input.aspects.includes(value.rubricItem)) fail();
    if (!Number.isInteger(value.originalMessageIndex) || value.originalMessageIndex < 0 || value.originalMessageIndex >= index || input.messages[value.originalMessageIndex]?.role !== 'assistant' || input.messages[value.originalMessageIndex]?.background) fail();
    if (!Number.isInteger(value.targetMessageIndex) || value.targetMessageIndex <= value.originalMessageIndex || value.targetMessageIndex >= index || input.messages[value.targetMessageIndex]?.role !== 'user' || !input.messages[value.targetMessageIndex].content.includes(value.targetQuote)) fail();
    if (!Number.isInteger(value.probeCount) || value.probeCount < 1 || value.probeCount > 2) fail();
    if (previous?.phase === 'probe') {
      for (const key of ['originalMessageIndex', 'targetMessageIndex', 'targetQuote', 'rubricItem', 'prerequisite', 'probeLevel', 'returnTarget']) if (value[key] !== previous[key]) fail();
      if (value.probeCount !== previous.probeCount + (value.phase === 'probe' ? 1 : 0)) fail();
    } else {
      if (value.phase !== 'probe' || value.probeCount !== 1 || used.has(value.rubricItem)) fail();
      used.add(value.rubricItem);
    }
    previous = value;
    // An unmarked response must not silently drop a pending return path.
    const next = input.messages.slice(index + 1).find(m => m.role === 'assistant');
    if (value.phase === 'probe' && next && !next.background) fail();
  }
  return previous;
}

export function backgroundInstructions(input) {
  const history = validateBackgroundHistory(input);
  const state = history?.phase === 'probe' ? history : null;
  return `Original question anchors (zero-based indices in the CURRENT STAGE input.messages, not the model conversation or setup message): ${JSON.stringify(input.messages.flatMap((m, index) => m.role === 'assistant' && !m.background ? [{ index, question: m.content.slice(0, 200) }] : []))}. Background bridge policy: use ${backgroundStrategyId} only for a specific, evidence-linked prerequisite obstacle, not merely a short answer, an error, or frustration. Prefer clarification when wording is the obstacle. A quoted statement that the learner cannot recall or explain a named prerequisite relationship IS evidence of a prerequisite obstacle; no prior solution or answered prerequisite question is required. When the harder reasoning depends on that explicitly unavailable knowledge, prefer this bridge over a higher-level diagnostic that assumes it, or a fallback that asks the learner to perform it anyway. Do not label a deliberate lower-level prerequisite probe as mechanism-tracing or answer-reason-consistency. Preserve the full rubric target across the SEQUENCE: this strategy temporarily probes a prerequisite instead of performing every relationship in the harder target in that same question. This is an explicit exception to same-turn level and complete-target requirements, not a new passing target. A probe may temporarily ask for recall or explanation (or simpler application at Apply/Analyze), while the active task and rubric stay unchanged. At Understand stay in the established setting without a new application exercise. Never provide the missing principle or answer. Return background metadata only for this strategy, otherwise null. Use action probe for one prerequisite question, return when its answer establishes the needed idea, or exit to reframe an accessible part of the original task when stuck or when the teacher changes direction. Ask only one question per turn. Do not open another detour for a rubric item already probed in this stage. ${state ? `Continue this pending sequence: ${JSON.stringify(state)}. Preserve its prerequisite, level, return target, original index, and rubric item. Select this strategy and return/exit, or one narrower probe if probeCount is below 2. If probeCount is 2, another probe is forbidden. If the prerequisite is established, ask the teacher to connect it to the original task, without supplying that connection. If still stuck, reframe an accessible part of the original task or briefly offer continuing versus requesting help; never force an unanswerable full solution.` : 'For an initial probe, identify an actual earlier assistant question as originalMessageIndex, specify the prerequisite as a topic rather than its answer, and specify returnTarget as the reasoning the teacher will need to supply, without drafting its solution.'}`;
}

export function backgroundForChoice(input, choice) {
  const previous = validateBackgroundHistory(input);
  const pending = previous?.phase === 'probe' ? previous : null;
  const bridge = choice?.background;
  if (choice.strategyId !== backgroundStrategyId) {
    if (pending) throw new InvalidOutputError('Continue the pending background bridge with a return, exit, or one permitted narrower probe.');
    if (bridge != null) throw new InvalidOutputError('Only the background bridge strategy may return background metadata.');
    return null;
  }
  if (!bridge || !phases.includes(bridge.action) || !demands.includes(bridge.probeLevel) || !isText(bridge.prerequisite) || !isText(bridge.returnTarget)) throw new InvalidOutputError('Provide the background prerequisite, probe demand, original question index, return target, and action.');
  if (pending) {
    if (choice.rubricItem !== pending.rubricItem || ['originalMessageIndex', 'prerequisite', 'probeLevel', 'returnTarget'].some(k => bridge[k] !== pending[k])) throw new InvalidOutputError('Preserve the pending background task and prerequisite.');
    if (bridge.action === 'probe' && pending.probeCount >= 2) throw new InvalidOutputError('Two background probes have been used. Return or exit this detour.');
    return { ...pending, phase: bridge.action, probeCount: pending.probeCount + (bridge.action === 'probe' ? 1 : 0) };
  }
  if (bridge.action !== 'probe' || input.messages.some(m => m.background?.rubricItem === choice.rubricItem)) throw new InvalidOutputError('Start with one probe; do not reopen a background detour for this rubric item.');
  const targetMessageIndex = input.messages.findLastIndex(m => m.role === 'user' && m.content.includes(choice.targetQuote));
  const value = { topic: input.topic, taskLevel: input.level, phase: 'probe', originalMessageIndex: bridge.originalMessageIndex, targetMessageIndex, targetQuote: choice.targetQuote, rubricItem: choice.rubricItem, prerequisite: bridge.prerequisite, probeLevel: bridge.probeLevel, returnTarget: bridge.returnTarget, probeCount: 1 };
  try { validateBackgroundHistory({ ...input, messages: [...input.messages, { role: 'assistant', background: value }] }); }
  catch { throw new InvalidOutputError('Link the background probe to a valid earlier question, learner quote, active rubric item, and permitted probe level.'); }
  return value;
}

export const backgroundAssessmentInstructions = 'Background metadata describes the opportunity offered, not learner evidence or scoring instructions. A response to a prerequisite question alone does not establish the original task. Do not treat failure on that probe as an attempted full solution; it can still reveal a relevant gap or error. Keep every active rubric and independence/transfer rule unchanged. If the latest assistant asked a background probe, return backgroundResponseScope: set originalTaskDemonstrated true ONLY if the latest user independently goes beyond the prerequisite and actually demonstrates the original task; quote an exact excerpt of that original-task reasoning, otherwise false and an empty quote. Do not require a redundant return if genuine volunteered original-task reasoning already satisfies the task.';

export function latestBackgroundProbe(input) {
  const previous = input.messages.at(-2);
  return previous?.role === 'assistant' && previous.background?.phase === 'probe' && previous.background.taskLevel === input.level && previous.background.topic === input.topic ? previous.background : null;
}
