import { createHash } from 'node:crypto';

// Successful evaluator work only, scoped to account/provider/model and exact prompts.
// A failed reply never becomes a cached response. Entries expire in memory.
export class EvaluationCache {
  constructor({ ttl = 120_000, limit = 20, now = Date.now } = {}) { this.entries = new Map(); this.ttl = ttl; this.limit = limit; this.now = now; }
  key(scope, version, input, evaluator) { return createHash('sha256').update(JSON.stringify([scope, version, input, evaluator])).digest('hex'); }
  get(key) {
    this.prune();
    const item = this.entries.get(key);
    return item ? structuredClone(item.value) : undefined;
  }
  prune() { for (const [key, item] of this.entries) if (item.expires <= this.now()) this.entries.delete(key); }
  set(key, value) {
    this.prune();
    this.entries.delete(key);
    this.entries.set(key, { value: structuredClone(value), expires: this.now() + this.ttl });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
  }
}
