/**
 * @typedef {{type: 'text', text: string} | {type: 'image' | 'document', mimeType: string, data: string}} ContentBlock
 * @typedef {{role: 'user' | 'assistant', content: string | ContentBlock[]}} ModelMessage
 * @typedef {{name: string, description?: string, schema: object}} StructuredResponse
 * @typedef {{instructions: string, messages: ModelMessage[], response: StructuredResponse, signal?: AbortSignal}} GenerationRequest
 * @typedef {{configured: boolean, model: string}} ProviderStatus
 * @typedef {{slug: string, name: string}} Model
 * @typedef {{id: string, label: string, description: string, configurationKind: 'api-key' | 'chatgpt', configurationHelp: string, configuredMessage: string, supportsModelSelection: boolean, capabilities: {images: boolean, pdfs: boolean}}} ProviderMetadata
 */

export class AIError extends Error {
  constructor(message, status = 502) { super(message); this.name = 'AIError'; this.status = status; }
}

/** Abstract-style API adapter. Subclasses provide static metadata and all three methods. */
export class LanguageModelProvider {
  constructor() {
    if (new.target === LanguageModelProvider) throw new TypeError('Implement a LanguageModelProvider subclass.');
  }
  /** @returns {ProviderMetadata} */
  get metadata() { return this.constructor.metadata; }
  /** @returns {ProviderStatus} Never include credentials in status. */
  getStatus() { throw new TypeError('Implement getStatus().'); }
  /** @returns {Promise<Model[]>} */
  async listModels() { throw new TypeError('Implement listModels().'); }
  /** @param {GenerationRequest} request @returns {Promise<object>} */
  async generateStructured(_request) { throw new TypeError('Implement generateStructured().'); }
}

/** The only invocation boundary used by learning code. No API-specific wire formats. */
export async function invokeProvider(provider, request) {
  const { label, capabilities } = provider.metadata;
  for (const message of request.messages) {
    if (typeof message.content === 'string') continue;
    for (const block of message.content) {
      if (block.type === 'text') continue;
      if (block.type === 'image' && capabilities.images) continue;
      if (block.type === 'document' && block.mimeType === 'application/pdf' && capabilities.pdfs) continue;
      throw new AIError(`${label} does not support this attachment type. Choose another provider in AI settings.`, 400);
    }
  }
  const longRequest = ['extract_concepts', 'suggest_concepts', 'generate_rubric'].includes(request.response.name);
  const timeout = AbortSignal.timeout(longRequest ? 180_000 : 60_000);
  const signal = request.signal ? AbortSignal.any([timeout, request.signal]) : timeout;
  try {
    signal.throwIfAborted();
    const result = await provider.generateStructured({ ...request, signal });
    signal.throwIfAborted();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new AIError(`${label} returned invalid structured data. Please retry.`);
    return result;
  } catch (error) {
    if (signal.aborted || error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new AIError(longRequest ? 'Rubric generation took too long. Please retry with shorter files.' : `${label} took too long. Please retry.`, 504);
    if (error instanceof AIError) throw error;
    // Unexpected transport errors can contain URLs, headers, or credentials.
    throw new AIError(`Could not complete the ${label} request. Please retry.`);
  }
}

/** @returns {(instructions: string, messages: ModelMessage[], response: StructuredResponse, options?: {signal?: AbortSignal}) => Promise<object>} */
export function createProviderQuery(provider) {
  return (instructions, messages, response, options = {}) => invokeProvider(provider, { instructions, messages, response, signal: options.signal });
}
