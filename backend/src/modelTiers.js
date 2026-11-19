// Short, schema-validated tasks that do not need the configured main model.
// Grading (evaluate_refined) and the classmate reply deliberately stay off this list.
export const LIGHT_OPERATIONS = new Set(['summarize_student_results', 'select_puzzle_skills', 'suggest_concepts']);

export const DEFAULT_LIGHT_MODEL = 'claude-haiku-5-5';

/** Returns the Anthropic model for one operation. An empty ANTHROPIC_LIGHT_MODEL disables routing. */
export function modelFor(operation, mainModel, env = process.env) {
  if (!LIGHT_OPERATIONS.has(operation)) return mainModel;
  const light = env.ANTHROPIC_LIGHT_MODEL === undefined ? DEFAULT_LIGHT_MODEL : env.ANTHROPIC_LIGHT_MODEL.trim();
  return light || mainModel;
}

export const isLightOperation = operation => LIGHT_OPERATIONS.has(operation);
