import { InvalidOutputError } from '../structuredOutput.js';
import { AIError, LanguageModelProvider, PROMPT_CACHE_BOUNDARY } from './LanguageModelProvider.js';
import { isLightOperation, modelFor } from '../modelTiers.js';

// Operations sent on every learner message. Their tools and system prompt repeat
// across a session, so caching them makes later turns read that prefix cheaply.
const CACHED_OPERATIONS = new Set(['evaluate_refined', 'reply_to_teacher']);

// Grading, replies, rubrics and puzzles run only on Opus; light tasks use modelTiers.js.
export const DEFAULT_TOP_MODEL = 'claude-opus-5-5';
export const isTopModel = model => /^claude-opus-[a-z0-9-]+$/.test(model || '');

export function anthropicSystem(instructions, operation, suffix = '') {
  const [stable, ...rest] = instructions.split(PROMPT_CACHE_BOUNDARY);
  const tail = `${rest.join('\n')}${suffix}`;
  if (!rest.length && !CACHED_OPERATIONS.has(operation)) return `${stable}${suffix}`;
  return [{ type: 'text', text: stable, cache_control: { type: 'ephemeral' } }, ...(tail.trim() ? [{ type: 'text', text: tail }] : [])];
}

export function anthropicMessages(messages) {
  return messages.map(message => ({ ...message, content: typeof message.content === 'string' ? message.content : message.content.map(block => block.type === 'text'
    ? { type: 'text', text: block.text }
    : { type: block.type, source: { type: 'base64', media_type: block.mimeType, data: block.data } }) }));
}

export class AnthropicProvider extends LanguageModelProvider {
  static metadata = {
    id: 'anthropic', label: 'Anthropic / Claude', description: 'Use the configured Anthropic API key and billing.',
    configurationKind: 'api-key', configurationHelp: 'Set ANTHROPIC_API_KEY in backend/.env and restart the app to use Claude.',
    configuredMessage: 'Your Anthropic API key is configured. AI requests use Claude and are billed to that key.',
    supportsModelSelection: true, capabilities: { images: true, pdfs: true },
  };
  constructor({ env = process.env, model = '', fetcher = (...args) => fetch(...args) } = {}) {
    super(); this.env = env; this.model = model; this.fetcher = fetcher;
  }
  getStatus() { return { configured: Boolean(this.env.ANTHROPIC_API_KEY?.trim()), model: [this.model, this.env.ANTHROPIC_MODEL?.trim()].find(isTopModel) || DEFAULT_TOP_MODEL }; }
  headers() {
    return { 'x-api-key': this.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', ...(this.env.ANTHROPIC_WORKSPACE_ID?.trim() ? { 'anthropic-workspace-id': this.env.ANTHROPIC_WORKSPACE_ID.trim() } : {}) };
  }
  async listModels() {
    if (!this.getStatus().configured) throw new AIError('Configure your Anthropic API key in backend/.env to list Claude models.', 400);
    const models = [];
    let cursor = '';
    const signal = AbortSignal.timeout(30_000);
    do {
      const url = new URL('https://api.anthropic.com/v1/models');
      url.searchParams.set('limit', '1000');
      if (cursor) url.searchParams.set('after_id', cursor);
      const response = await this.fetcher(url.toString(), { headers: this.headers(), signal });
      if (!response.ok) throw new AIError(response.status === 401 ? 'Claude rejected the API key. Check backend/.env.' : response.status === 429 ? 'Claude is rate limited. Please retry shortly.' : `Could not list Claude models (${response.status}). Check your API key and workspace in backend/.env.`, [401, 403, 429].includes(response.status) ? response.status : 502);
      const data = await response.json();
      if (!Array.isArray(data.data) || data.data.some(model => typeof model.id !== 'string')) throw new AIError('Claude returned an invalid model list. Please retry.');
      models.push(...data.data.filter(model => isTopModel(model.id)).map(model => ({ slug: model.id, name: model.display_name || model.id })));
      if (!data.has_more) break;
      if (!data.last_id || data.last_id === cursor) throw new AIError('Claude returned an invalid model list. Please retry.');
      cursor = data.last_id;
    } while (true);
    if (!models.length) throw new AIError('No Claude Opus models are available for this API key. Check your workspace permissions.', 403);
    return models;
  }
  async generateStructured({ instructions, messages, response: output, signal, onUsage }) {
    const model = modelFor(output.name, this.getStatus().model, this.env);
    // These models reject forced tool_choice; require our tool in the prompt
    // and keep validating the returned tool call below.
    const automaticTools = /^claude-(?:sonnet|opus)-5-5(?:-|$)/.test(model);
    // Light tasks are short and validated; low effort keeps thinking spend small.
    const effort = isLightOperation(output.name) && /^claude-(?:haiku|sonnet|opus)-5-5(?:-|$)/.test(model) ? { output_config: { effort: 'low' } } : {};
    const response = await this.fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', ...this.headers() },
      body: JSON.stringify({ model, max_tokens: output.name === 'generate_apply_puzzle' ? 16384 : ['evaluate_learning', 'evaluate_refined', 'review_refined_shadow', 'extract_concepts', 'generate_rubric'].includes(output.name) ? 8192 : 4096,
        system: anthropicSystem(instructions, output.name, automaticTools ? `\n\nReturn your final result by calling ${output.name} exactly once with arguments matching its schema. A plain text response cannot be processed by this application.` : ''), ...effort,
        messages: anthropicMessages(messages), tools: [{ name: output.name, description: output.description, input_schema: output.schema }], tool_choice: automaticTools ? { type: 'auto' } : { type: 'tool', name: output.name } }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (response.status === 400 && /anthropic-workspace-id/i.test(error?.error?.message || '')) throw new AIError('This Claude key requires a workspace ID. Set ANTHROPIC_WORKSPACE_ID in backend/.env, or use a workspace-scoped API key, then restart the app.', 400);
      throw new AIError(response.status === 401 ? 'Claude rejected the API key.' : response.status === 429 ? 'Claude is rate limited. Please retry shortly.' : `Claude request failed (${response.status}). Check the configured Claude model and workspace.`, [401, 403, 429].includes(response.status) ? response.status : 502);
    }
    const data = await response.json();
    await onUsage?.({ model: data.model || model, usage: data.usage });
    const calls = Array.isArray(data?.content) ? data.content.filter(block => block?.type === 'tool_use' && block.name === output.name) : [];
    if (data.stop_reason === 'max_tokens' || calls?.length !== 1) throw new InvalidOutputError('Claude returned an incomplete response. Please retry.');
    return calls[0].input;
  }
}
