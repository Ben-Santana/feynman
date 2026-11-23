// Standard global Claude API rates (USD / million tokens).
// Source: https://platform.claude.com/docs/en/about-claude/pricing
// Unknown models and ChatGPT subscriptions deliberately have no dollar estimate.
export function usageCost(model, usage) {
  const rates = [
    [/^claude-sonnet-5-5(?:-|$)/, 2, 10, .05],
    [/^claude-opus-5-5(?:-|$)/, 4, 20, .05],
    // Haiku 5.5 has a second rate card ($0.50 / $2.50) for prompts over 100K tokens.
    [/^claude-haiku-5-5(?:-|$)/, .1, .5, .1, { above: 100_000, input: .5, output: 2.5 }],
    [/^claude-sonnet-4-(?:5|6)(?:-|$)/, 3, 15, .1],
    [/^claude-opus-4-(?:5|6|7|8)(?:-|$)/, 5, 25, .1],
    [/^claude-haiku-4-5(?:-|$)/, 1, 5, .1],
  ];
  const rate = rates.find(([pattern]) => pattern.test(model));
  if (!rate) return null;
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const [, baseInput, baseOutput, read, long] = rate;
  const prompt = count(usage.input_tokens) + count(usage.cache_read_input_tokens) + count(usage.cache_creation_input_tokens);
  const [input, output] = long && prompt > long.above ? [long.input, long.output] : [baseInput, baseOutput];
  const writes = count(usage.cache_creation_input_tokens);
  const hourWrites = count(usage.cache_creation?.ephemeral_1h_input_tokens);
  return (count(usage.input_tokens) * input + count(usage.output_tokens) * output
    + count(usage.cache_read_input_tokens) * input * read
    + (writes - Math.min(writes, hourWrites)) * input * 1.25 + hourWrites * input * 2) / 1e6;
}

export function usageRecord({ userId, feature, operation, provider, model, usage }) {
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return { user_id: userId, feature, operation, provider, model,
    input_tokens: count(usage?.input_tokens), output_tokens: count(usage?.output_tokens),
    cache_read_tokens: count(usage?.cache_read_input_tokens), cache_write_tokens: count(usage?.cache_creation_input_tokens),
    cost_usd: provider === 'anthropic' && usage ? usageCost(model, usage) : null,
    usage_reported: Boolean(usage),
  };
}

export const usageFeatures = {
  '/api/chat': 'Learning sessions', '/api/concepts': 'Concept extraction',
  '/api/concept-suggestions': 'Concept suggestions', '/api/rubric': 'Rubric generation', '/api/teaching-guide': 'Teaching checklists',
  '/api/developer/rubric': 'Rubric testing', '/api/developer/puzzles': 'Puzzle generation',
  '/api/developer/question-comparison': 'Question comparisons', '/api/developer/question-review': 'Question reviews',
  '/api/developer/evaluator-comparison': 'Evaluator comparisons',
};
