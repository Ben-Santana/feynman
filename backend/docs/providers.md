# Adding a language-model API

Each API has one `LanguageModelProvider` subclass. Models served by that API are configuration values, not separate subclasses. ChatGPT and Anthropic are working examples in `backend/src/providers/`.

## Contract

Implement these methods:

- `getStatus()` synchronously returns `{ configured, model }`. It checks local configuration without making a network request.
- `listModels()` asynchronously returns `[{ slug, name }]`. A provider with a fixed environment-configured model returns a one-item list.
- `generateStructured({ instructions, messages, response, signal })` asynchronously returns the parsed response object. Translate the request, call your API, and enforce that API's successful-completion rules. Honor `signal` in HTTP calls. API preparation that performs additional network requests should also honor cancellation.

`response` is `{ name, description, schema }`, where `schema` is a JSON Schema for the expected object. Use tools or your API's structured-output support to produce it. The adapter returns the object itself, not an envelope, stream, or JSON string. Learning and rubric code validate the educational meaning of the fields.

A message is `{ role: 'user' | 'assistant', content }`. Content is a string or an array of:

```js
{ type: 'text', text: 'Study this' }
{ type: 'image', mimeType: 'image/png', data: 'BASE64_BYTES' }
{ type: 'document', mimeType: 'application/pdf', data: 'BASE64_BYTES' }
```

Uploaded Office and text files are already extracted into text before they reach the adapter. Images and PDFs retain their MIME type and base64 bytes. `AnthropicProvider` converts these blocks into Anthropic sources; `ChatGPTProvider` converts them into Responses input items.

`invokeProvider` and `createProviderQuery` apply the shared timeout, capability check, error normalization, and object-result check. `createProviderQuery` exposes the internal `(instructions, messages, response, options?)` function used by learning code; it forwards the optional caller signal. Normal requests have 60 seconds, and `extract_concepts`, `suggest_concepts`, and `generate_rubric` have 180 seconds. Always use this invocation boundary from application code rather than calling the adapter directly.

Throw `AIError(safeMessage, httpStatus)` for an actionable upstream failure. Never copy arbitrary upstream bodies, tokens, headers, or URLs into messages. Unexpected errors are replaced with a generic message by the invocation wrapper. There is no automatic provider fallback.

## Metadata and registration

Define `static metadata` on your class, with:

```js
static metadata = {
  id: 'example',
  label: 'Example API',
  description: 'Use the configured Example API key and billing.',
  configurationKind: 'api-key',
  configurationHelp: 'Set EXAMPLE_API_KEY and EXAMPLE_MODEL in backend/.env, then restart the app.',
  configuredMessage: 'Your Example API key is configured. Requests are billed to that key.',
  supportsModelSelection: false,
  capabilities: { images: true, pdfs: false },
};
```

Keep credentials in server-owned constructor dependencies. Use `process.env` and `fetch` as defaults, and allow injected values for tests. Follow `AnthropicProvider` for a fixed model, or `ChatGPTProvider` for account-specific model selection.

Import your class into `registry.js` and add one factory registration in `createProviderRegistry`:

```js
.register(ExampleProvider, selection => new ExampleProvider({ ...selection, env, fetcher }))
```

Factories receive `{ accountId, model }` for the request. Fixed-model providers ignore that selection and use their configured model. Model-selecting providers validate the requested model against their own available catalog before inference. Keep provider IDs stable: they are stored in browser preferences and sent in `X-Feynman-Provider`.

The server resolves inference, health, and model listing through the registry. `GET /api/ai/providers` exposes safe metadata and status. AI settings renders the registered provider automatically, displays setup instructions when unconfigured, and displays the configured model or a model picker. API keys stay in `backend/.env`; the UI never accepts or stores them. Environment-backed APIs need no frontend or learning changes. A new interactive authentication flow needs its own account-management UI; `configurationKind: 'chatgpt'` is reserved for the existing ChatGPT connection panel.

## Tests and compatibility

Add adapter tests with an injected fetcher that check request conversion, structured results, rejected or incomplete responses, safe error messages, and signal forwarding. The shared contract and a fake third-provider registration are exercised in `backend/src/providers.test.js`. Run `npm test`, `npm run build`, and `npm run lint`.

Existing provider IDs, saved preferences, ChatGPT credentials/OAuth callbacks, and API response fields remain compatible. HTTP callers omitting `X-Feynman-Provider` still select Anthropic. The browser defaults to ChatGPT. An unavailable saved provider remains selected until the user chooses another provider; discovery stays accessible so they can recover without silently changing billing or services.
