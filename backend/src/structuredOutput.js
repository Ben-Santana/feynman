// Only malformed model output is retried. Input, authentication, rate-limit,
// timeout and transport failures must retain their original meaning.
export class InvalidOutputError extends Error {}

export async function retryStructuredOutput(run, budget = 60_000, maxAttempts = 2) {
  const signal = AbortSignal.timeout(budget);
  let previousError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await run(attempt, signal, previousError); }
    catch (error) {
      const retrying = !signal.aborted && attempt + 1 < maxAttempts && error instanceof InvalidOutputError;
      console.error('Structured output attempt failed', { attempt: attempt + 1, retrying, error });
      if (!retrying) throw error;
      previousError = error;
    }
  }
}

export function repairQuery(query, attempt, signal, previousError) {
  return (instructions, messages, response, options) => query(attempt
    ? `${instructions}\n\nThe previous response could not be validated.${previousError ? ` Validation error: ${previousError.message}` : ''} Return the complete requested tool response matching its schema. Preserve every requested name and checklist aspect exactly, including repeated entries and the requested counts. Do not omit required fields.${['generate_rubric', 'extract_concepts'].includes(response.name) ? ' Keep each rubric checklist within 1,000 characters including numbering.' : ''}`
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
