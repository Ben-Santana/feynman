// Only malformed model output is retried. Input, authentication, rate-limit,
// timeout and transport failures must retain their original meaning.
export class InvalidOutputError extends Error {}

export async function retryStructuredOutput(run, budget = 60_000) {
  const signal = AbortSignal.timeout(budget);
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await run(attempt, signal); }
    catch (error) {
      if (signal.aborted || attempt || !(error instanceof InvalidOutputError)) throw error;
    }
  }
}

export function repairQuery(query, attempt, signal) {
  return (instructions, messages, response, options) => query(attempt
    ? `${instructions}\n\nThe previous response could not be validated. Return the complete requested tool response matching its schema. Preserve every requested name and checklist aspect exactly, including repeated entries and the requested counts. Do not omit required fields.${['generate_rubric', 'extract_concepts'].includes(response.name) ? ' Keep each rubric checklist within 1,000 characters including numbering.' : ''}`
    : instructions, messages, response, { ...options, signal: options?.signal && signal ? AbortSignal.any([options.signal, signal]) : signal || options?.signal });
}

// Match a multiset rather than trusting array order. Do not guess aliases or
// attach a judgment to a different criterion, including duplicate criteria.
export function orderByNames(items, names, key) {
  if (!Array.isArray(items) || items.length !== names.length) return null;
  const remaining = [...items];
  const ordered = [];
  for (const name of names) {
    const index = remaining.findIndex(item => item?.[key] === name);
    if (index < 0) return null;
    ordered.push(remaining.splice(index, 1)[0]);
  }
  return ordered;
}
