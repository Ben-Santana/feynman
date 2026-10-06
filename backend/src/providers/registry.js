import { AIError, LanguageModelProvider } from './LanguageModelProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { ChatGPTProvider } from './ChatGPTProvider.js';

/** Factories receive request selection; credentials remain in server-owned dependencies. */
export class ProviderRegistry {
  #entries = new Map();
  register(Provider, create = selection => new Provider(selection)) {
    const metadata = Provider.metadata;
    if (!(Provider.prototype instanceof LanguageModelProvider) || !/^[a-z][a-z0-9-]*$/.test(metadata?.id || '')) throw new TypeError('Register a LanguageModelProvider subclass with a valid metadata.id.');
    for (const method of ['getStatus', 'listModels', 'generateStructured']) {
      if (Provider.prototype[method] === LanguageModelProvider.prototype[method]) throw new TypeError(`Provider ${metadata.id} must implement ${method}().`);
    }
    if (this.#entries.has(metadata.id)) throw new TypeError(`Provider ${metadata.id} is already registered.`);
    this.#entries.set(metadata.id, { metadata, create });
    return this;
  }
  resolve(id, selection = {}) {
    const entry = this.#entries.get(id);
    if (!entry) throw new AIError('Your selected AI provider is unavailable. Choose a registered provider in AI settings.', 400);
    return entry.create(selection);
  }
  describe(selection = {}) {
    return [...this.#entries.entries()].map(([id, { metadata }]) => {
      const { configured, model } = this.resolve(id, selection).getStatus();
      // Explicit public fields: never serialize an adapter or its dependencies.
      return { id, label: metadata.label, description: metadata.description,
        configurationKind: metadata.configurationKind, configurationHelp: metadata.configurationHelp,
        configuredMessage: metadata.configuredMessage, supportsModelSelection: metadata.supportsModelSelection,
        capabilities: { images: metadata.capabilities.images, pdfs: metadata.capabilities.pdfs }, configured, model };
    });
  }
}

export function createProviderRegistry({ chatgpt, env = process.env, fetcher = (...args) => fetch(...args) } = {}) {
  return new ProviderRegistry()
    .register(ChatGPTProvider, selection => new ChatGPTProvider({ ...selection, runtime: chatgpt, fetcher }))
    .register(AnthropicProvider, selection => new AnthropicProvider({ ...selection, env, fetcher }));
}
