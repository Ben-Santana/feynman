import { assessmentTool, normalizeAssessment } from './evaluatorContracts.js';
import { InvalidOutputError } from './structuredOutput.js';

export function leanAssessmentTool(context, task, name) {
  const tool = assessmentTool(context, name);
  const detailed = tool.schema.properties.judgments.items;
  const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  tool.schema.properties.judgments.items = { anyOf: [...context.criteria, task].map(d => {
    const evidence = { messageId: { type: 'string' }, quote: { type: 'string', maxLength: 2000 } };
    if (d.components.length > 1) evidence.componentIds = { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', enum: d.components.map(c => c.id) } };
    if (d.requiresIndependent) Object.assign(evidence, { assistance: { type: 'string', enum: ['none', 'clarification', 'hint', 'explanation_or_answer', 'unknown'] }, assistanceMessageIds: { type: 'array', maxItems: 20, items: { type: 'string' } } });
    if (d.requiresTransfer) evidence.demonstratesTransfer = { type: 'boolean' };
    const properties = Object.fromEntries(['status', 'result', 'reasoning', 'opportunity', 'reason', 'abstentionReason', 'contradictions'].map(key => [key, detailed.properties[key]]));
    Object.assign(properties, { criterionId: { type: 'string', enum: [d.id] }, observations: { type: 'array', maxItems: 40, items: object(evidence) } });
    if (d.requiresIndependent) properties.independentCheck = detailed.properties.independentCheck;
    if (d.requiresTransfer) properties.transferCheck = detailed.properties.transferCheck;
    return object(properties);
  }) };
  return tool;
}

// Adapt concise output into the existing validator. Defaults never assert
// independence, transfer, fair opportunity, correctness, or component coverage.
export function normalizeLeanAssessment(result, context, task) {
  if (!Array.isArray(result?.judgments)) throw new InvalidOutputError('Invalid lean evaluator judgments.');
  const definitions = [...context.criteria, task];
  const judgments = result.judgments.map(j => {
    const d = definitions.find(d => d.id === j?.criterionId);
    if (!d || !Array.isArray(j.observations)) throw new InvalidOutputError('Invalid lean evaluator evidence.');
    return { ...j,
      independentCheck: j.independentCheck === undefined && !d.requiresIndependent ? 'not_required' : j.independentCheck,
      transferCheck: j.transferCheck === undefined && !d.requiresTransfer ? 'not_required' : j.transferCheck,
      observations: j.observations.map(o => ({ ...o,
        relevance: o?.relevance === undefined ? 'Evidence cited for this judgment.' : o.relevance,
        componentIds: o?.componentIds === undefined && d.components.length === 1 ? [d.components[0].id] : o?.componentIds,
        assistance: o?.assistance === undefined && !d.requiresIndependent ? 'unknown' : o?.assistance,
        assistanceAssessed: Boolean(d.requiresIndependent || o?.assistance !== undefined),
        assistanceMessageIds: o?.assistanceMessageIds === undefined && !d.requiresIndependent ? [] : o?.assistanceMessageIds,
        demonstratesTransfer: o?.demonstratesTransfer === undefined && !d.requiresTransfer ? false : o?.demonstratesTransfer,
      })),
    };
  });
  return normalizeAssessment({ ...result, judgments }, context, task);
}
