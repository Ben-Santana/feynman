import { AIError, LanguageModelProvider } from './LanguageModelProvider.js';

function responseError(status, code) {
  if (code === 'subscription_sharing_usage_limit_exceeded' || status === 429) return new AIError('Your ChatGPT plan usage limit was reached. Manage usage in ChatGPT settings, wait for it to reset, or choose Anthropic in AI settings.', 429);
  if (code === 'subscription_sharing_usage_unavailable' || status === 403) return new AIError('ChatGPT plan usage is unavailable. Check the app permission and your eligible plan, or choose Anthropic in AI settings.', 403);
  if (status === 401) return new AIError('ChatGPT access expired or was revoked. Continue with ChatGPT again in AI settings.', 401);
  return new AIError(`ChatGPT request failed (${status || 'unknown error'}). Please retry or check your model in AI settings.`);
}

export function responseInput(messages) {
  return messages.map(message => ({ role: message.role, content: typeof message.content === 'string' ? message.content : message.content.map(block => {
    if (block.type === 'text') return { type: message.role === 'assistant' ? 'output_text' : 'input_text', text: block.text };
    if (block.type === 'image') return { type: 'input_image', image_url: `data:${block.mimeType};base64,${block.data}` };
    if (block.type === 'document') return { type: 'input_file', filename: 'study-material.pdf', file_data: `data:${block.mimeType};base64,${block.data}` };
    throw new AIError('This attachment type is not supported by ChatGPT.', 400);
  }) }));
}

export async function readResponseStream(response, toolName) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let completed;
  const finishedItems = new Map();
  const consume = frame => {
    const raw = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!raw || raw === '[DONE]') return;
    const event = JSON.parse(raw);
    if (event.type === 'response.failed' || event.type === 'error') throw responseError(null, event.response?.error?.code || event.code);
    if (event.type === 'response.incomplete') throw new AIError('ChatGPT returned an incomplete response. Please retry.');
    if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') finishedItems.set(event.output_index, event.item);
    if (event.type === 'response.completed') completed = event.response;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (pending.length > 4_000_000) throw new AIError('ChatGPT returned an oversized response. Please retry.');
      let end;
      while ((end = /\r?\n\r?\n/.exec(pending))) { consume(pending.slice(0, end.index).replaceAll('\r\n', '\n')); pending = pending.slice(end.index + end[0].length); }
      if (done) break;
    }
    if (pending.trim()) consume(pending.replaceAll('\r\n', '\n'));
    if (!completed || completed.status !== 'completed') throw new AIError('ChatGPT disconnected before completing its response. Please retry.');
    // ChatGPT plan streams can leave the terminal output array empty even
    // after emitting complete tool arguments in response.output_item.done.
    const output = completed.output?.length ? completed.output : [...finishedItems.values()];
    const calls = output.filter(item => item.type === 'function_call' && item.name === toolName && item.namespace === 'feynman');
    if (calls.length !== 1 || (calls[0].status !== undefined && calls[0].status !== 'completed')) throw new AIError('ChatGPT returned an incomplete structured response. Please retry.');
    let result;
    try { result = JSON.parse(calls[0].arguments); } catch { throw new AIError('ChatGPT returned invalid structured data. Please retry.'); }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new AIError('ChatGPT returned invalid structured data. Please retry.');
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export class ChatGPTProvider extends LanguageModelProvider {
  static metadata = {
    id: 'chatgpt', label: 'ChatGPT plan', description: 'Use an eligible ChatGPT Plus or Pro account.',
    configurationKind: 'chatgpt', configurationHelp: 'Continue with ChatGPT in AI settings and allow plan usage, or choose another provider.',
    configuredMessage: 'ChatGPT plan usage is enabled.', supportsModelSelection: true,
    capabilities: { images: true, pdfs: true },
  };
  constructor({ runtime, accountId, model = '', fetcher = (...args) => fetch(...args) } = {}) {
    super(); this.runtime = runtime; this.accountId = accountId; this.model = model; this.fetcher = fetcher;
  }
  getStatus() {
    return { configured: this.runtime.accounts().some(item => item.id === this.accountId && item.connected), model: this.model || 'Account default' };
  }
  async listModels() { return this.runtime.listModels(this.accountId); }
  async generateStructured({ instructions, messages, response: output, signal }) {
    const available = await this.listModels();
    const model = this.model || available[0]?.slug;
    if (!available.some(item => item.slug === model)) throw new AIError('Choose a model available to this ChatGPT account in AI settings.', 400);
    const token = await this.runtime.accessToken(this.accountId);
    signal?.throwIfAborted();
    const response = await this.fetcher('https://api.openai.com/v1/responses', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, instructions, input: responseInput(messages), store: false, stream: true,
        tools: [{ type: 'namespace', name: 'feynman', description: 'Return structured learning responses.', tools: [{ type: 'function', name: output.name, description: output.description, parameters: output.schema, strict: false }] }],
        tool_choice: 'required', parallel_tool_calls: false }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw responseError(response.status, error?.error?.code);
    }
    return readResponseStream(response, output.name);
  }
}
