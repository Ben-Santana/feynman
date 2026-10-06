import { createServer } from 'node:http';
import { createAccessGate } from './access.js';
import { pathToFileURL } from 'node:url';
import { resolveLearningType } from '../../frontend/src/learningTypes.js';
import { chat, conceptsFromStudyTest, generateRubric, generateLevelRubric, suggestConceptsFromFiles, validate } from './chat.js';
import { listPrompts, savePrompt, PromptError, promptFile, loadPrompts } from './promptStore.js';
import { createChatGPT } from './chatgpt.js';
import { AIError, createProviderQuery } from './providers/LanguageModelProvider.js';
import { createProviderRegistry } from './providers/registry.js';

export function createApiServer({ query, hosted = false, env = process.env, promptsPath = promptFile, chatgpt = hosted ? null : createChatGPT(), providers = createProviderRegistry({ chatgpt, env }) } = {}) {
  const access = createAccessGate(env, hosted);
  const allowedOrigins = hosted
    ? [env.APP_ORIGIN, ...[env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`)].filter(Boolean).map(origin => new URL(origin).origin)
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
    const calls = req.url === '/api/chat' && req.headers['x-feynman-trace'] === '1' ? [] : null;
    const developer = req.url === '/api/developer/prompts';
    const callbackRequest = req.url === '/auth/callback' || req.url.startsWith('/auth/callback?');
    if (callbackRequest) console.info('Feynman ChatGPT callback: HTTP request received.');
    // Hosted instances cannot persist local OAuth credentials or source edits.
    if (hosted && (developer || callbackRequest || ['/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url))) return send(403, { error: 'ChatGPT connections and prompt editing require the local Feynman app. Choose Anthropic in AI settings on this deployment.' });
    if (!hosted && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return send(403, { error: 'The Feynman API is only available on localhost.' });
    if (req.method === 'GET' && callbackRequest) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      try {
        if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) throw new AIError('Use the original loopback callback address.', 400);
        await chatgpt.handleCallback(`http://${req.headers.host}${req.url}`);
        console.info('Feynman ChatGPT callback: account verified and connected.');
        res.writeHead(200); res.end('ChatGPT connected. Return to Feynman to use your account.');
      } catch (error) { console.info(`Feynman ChatGPT callback: failed with status ${error.status || 502}.`); res.writeHead(error.status || 502); res.end(error instanceof AIError ? error.message : 'Could not complete ChatGPT sign-in. Please try again.'); }
      return;
    }
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) return send(403, { error: 'Origin not allowed' });
    try {
      if (await access.handle(req, res, send)) return;
      if (!access.valid(req)) return send(401, { error: 'Access code required.' });
      if (developer && req.method === 'GET') return send(200, listPrompts(promptsPath));
      const provider = req.headers['x-feynman-provider'] || 'anthropic';
      const accounts = chatgpt?.accounts() || [];
      const accountId = req.headers['x-feynman-account'] || accounts.find(item => item.connected)?.id;
      const selectedModel = req.headers['x-feynman-model'] || '';
      const selection = { accountId, model: selectedModel };
      // Discovery must remain usable when a browser has saved an unavailable provider.
      if (req.method === 'GET' && req.url === '/api/ai/providers') return send(200, { providers: providers.describe(selection) });
      const adapter = providers.resolve(provider, selection);
      const { configured, model } = adapter.getStatus();
      if (req.method === 'GET' && req.url === '/api/health') return send(200, { configured, provider, model, accounts, pendingRegistration: chatgpt?.hasPendingRegistration?.() || false, anthropicConfigured: providers.describe(selection).some(item => item.id === 'anthropic' && item.configured) });
      if (req.method === 'GET' && req.url === '/api/ai/models') return send(200, { models: await adapter.listModels() });
      const aiControl = ['/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url);
      if (aiControl && (!req.headers.origin || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))) return send(403, { error: 'Open AI settings in the local Feynman app to manage accounts.' });
      if (req.method !== 'POST' || !['/api/chat', '/api/concepts', '/api/concept-suggestions', '/api/rubric', '/api/developer/rubric', '/api/developer/prompts', '/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url)) return send(404, { error: 'Not found' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        const limit = aiControl ? 10_000 : developer ? 200_000 : req.url === '/api/chat' ? 12_000_000 : 7_000_000;
        if (Buffer.byteLength(body) > limit) return send(413, { error: 'Request is too large.' });
      }
      let input;
      try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
      if (developer) return send(200, savePrompt(input, promptsPath));
      if (aiControl) {
        if (!input || Array.isArray(input) || typeof input !== 'object' || (input.accountId !== undefined && (typeof input.accountId !== 'string' || input.accountId.length > 200))) return send(400, { error: 'Choose a valid ChatGPT connection.' });
        if ((input.newRegistration !== undefined && typeof input.newRegistration !== 'boolean') || (input.newRegistration && input.accountId)) return send(400, { error: 'Choose an existing connection or add a new account.' });
        const port = server.address()?.port || Number(process.env.PORT || 3001);
        return send(200, req.url === '/api/ai/sign-in' ? await chatgpt.beginSignIn(input.accountId, `http://127.0.0.1:${port}/auth/callback`, { newRegistration: input.newRegistration === true }) : req.url === '/api/ai/remove-account' ? await chatgpt.removeAccount(input.accountId) : await chatgpt.signOut(input.accountId));
      }
      const selectedQuery = query || createProviderQuery(adapter);
      const configurationError = adapter.metadata.configurationHelp;
      if (req.url !== '/api/chat') {
        try { resolveLearningType(input?.learningType); } catch (error) { return send(400, { error: error.message }); }
        if (!configured) return send(503, { error: configurationError });
        try {
          if (req.url === '/api/developer/rubric') return send(200, await generateLevelRubric(input, selectedQuery, loadPrompts(promptsPath)));
          if (req.url === '/api/concept-suggestions') return send(200, { names: await suggestConceptsFromFiles(input.files, selectedQuery, input.learningType, loadPrompts(promptsPath)) });
          if (req.url === '/api/rubric') return send(200, { concepts: await generateRubric(input, selectedQuery, loadPrompts(promptsPath)) });
          return send(200, { concepts: await conceptsFromStudyTest(input, selectedQuery, loadPrompts(promptsPath)) });
        } catch (error) { return send(error instanceof AIError ? error.status : /^(Upload|Choose|Enter|Could not read|Could not generate)/.test(error.message) ? 400 : /^Rubric generation took too long/.test(error.message) ? 504 : 502, { error: error.message }); }
      }
      try { input = validate(input); } catch (error) { return send(400, { error: error.message }); }
      if (!configured) return send(503, { error: configurationError });
      const tracedQuery = calls ? async (instructions, messages, response, options) => {
        const call = { role: response.name === 'evaluate_learning' ? 'evaluator' : response.name === 'summarize_learning' ? 'report' : 'learner', request: structuredClone({ model, instructions, messages, response }) };
        calls.push(call);
        const started = Date.now();
        try {
          const result = await selectedQuery(instructions, messages, response, options);
          call.response = structuredClone(result);
          return result;
        } catch (error) { call.error = error.message; throw error; }
        finally { call.durationMs = Date.now() - started; }
      } : selectedQuery;
      const result = await chat(input, tracedQuery, loadPrompts(promptsPath));
      return send(200, { ...result, ...(calls ? { calls } : {}) });
    } catch (error) { return send(error instanceof PromptError || error instanceof AIError ? error.status : 502, { error: error.name === 'TimeoutError' ? 'The model took too long. Please retry.' : error.message, ...(calls ? { calls } : {}) }); }
  });
  server.on('clientError', (error, socket) => {
    const tls = error.rawPacket?.[0] === 0x16;
    console.info(`Feynman API connection: ${tls ? 'HTTPS attempted on the HTTP port' : error.code || 'invalid HTTP request'}.`);
    socket.destroy();
  });
  server.on('close', () => chatgpt?.close());
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  createApiServer().listen(port, '127.0.0.1', () => console.log(`Feynman API: http://127.0.0.1:${port}`));
}
