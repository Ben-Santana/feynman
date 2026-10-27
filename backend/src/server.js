import { InvalidOutputError } from './structuredOutput.js';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { AccountError, createAccountService } from './accounts.js';
import { pathToFileURL } from 'node:url';
import { resolveLearningType } from '../../frontend/src/learningTypes.js';
import { chat, conceptsFromStudyTest, generateRubric, generateLevelRubric, suggestConceptsFromFiles, validate } from './chat.js';
import { listPrompts, savePrompt, PromptError, promptFile, loadPrompts } from './promptStore.js';
import { createChatGPT } from './chatgpt.js';
import { AIError, createProviderQuery } from './providers/LanguageModelProvider.js';
import { createProviderRegistry } from './providers/registry.js';
import { compareQuestions } from './strategyComparison.js';
import { comparisonCases, corpusVersion } from './questionStrategies.js';
import { readSavedQuestionEvaluation, reviewQuestionPair } from './questionEvaluation.js';
import { compareEvaluators, comparisonOptions, deferredEvaluatorWork } from './evaluatorComparison.js';
import { createEvaluationContext, EvaluatorInputError, evaluatorVersion } from './evaluatorContracts.js';
import { evaluatorComparisonCases, evaluatorTestCases } from './evaluatorTestCases.js';
import { screenEvaluatorComparison } from './evaluatorBenchmark.js';
import { EvaluationCache } from './turnCache.js';

const evaluatorCases = evaluatorComparisonCases;

export function createApiServer({ query, hosted = false, env = process.env, promptsPath = promptFile, chatgpt = hosted ? null : createChatGPT(), providers = createProviderRegistry({ chatgpt, env }), accountService = createAccountService(env) } = {}) {
  const allowedOrigins = hosted
    ? [env.APP_ORIGIN, ...[env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`)].filter(Boolean).map(origin => new URL(origin).origin)
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
    const calls = req.url === '/api/chat' && req.headers['x-feynman-trace'] === '1' ? [] : null;
    const developer = req.url === '/api/developer/prompts';
    const comparison = req.url === '/api/developer/question-comparison';
    const questionReview = req.url === '/api/developer/question-review';
    const evaluatorComparison = req.url === '/api/developer/evaluator-comparison';
    const callbackRequest = req.url === '/auth/callback' || req.url.startsWith('/auth/callback?');
    if (callbackRequest) console.info('Feynman ChatGPT callback: HTTP request received.');
    // Hosted instances cannot persist local OAuth credentials or source edits.
    if (hosted && developer && req.method !== 'GET') return send(403, { error: 'Prompts are read-only on this deployment. Use the local Feynman app to edit them.' });
    if (hosted && (callbackRequest || ['/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url))) return send(403, { error: 'ChatGPT connections require the local Feynman app. Choose Anthropic in AI settings on this deployment.' });
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
      const url = new URL(req.url, 'http://localhost');
      const consentRoute = url.pathname === '/api/account/consent';
      const account = await accountService.authenticate(req, { allowPending: (url.pathname === '/api/account' && req.method === 'GET') || consentRoute });
      if (req.method === 'POST' && ['/api/chat', '/api/concepts', '/api/concept-suggestions', '/api/rubric'].includes(url.pathname)) await accountService.assertLearningSurvey?.(req, account);
      if (url.pathname === '/api/account' && req.method === 'GET') return send(200, account);
      const adminConsent = /^\/api\/admin\/users\/([^/]+)\/consent$/.exec(url.pathname);
      if ((consentRoute || adminConsent) && req.method === 'GET') {
        const pdf = await accountService.downloadConsent(account, adminConsent?.[1]);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="signed-consent.pdf"');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.writeHead(200); return res.end(pdf);
      }
      if (consentRoute && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 2000) return send(413, { error: 'Request is too large.' }); }
        let input;
        try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
        return send(200, await accountService.signConsent(account, input));
      }
      if (url.pathname.startsWith('/api/admin/')) {
        if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
        if (url.pathname === '/api/admin/courses' && req.method === 'GET') return send(200, await accountService.listCourses(account, url.searchParams));
        const courseTarget = /^\/api\/admin\/courses\/([^/]+)$/.exec(url.pathname);
        if (courseTarget && req.method === 'GET') return send(200, await accountService.viewCourse(account, courseTarget[1]));
        if (url.pathname === '/api/admin/users' && req.method === 'GET') return send(200, await accountService.listUsers(account, url.searchParams));
        const target = /^\/api\/admin\/users\/([^/]+)\/(role|approval)$/.exec(url.pathname);
        if (!target || req.method !== 'PATCH') return send(404, { error: 'Not found' });
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 1000) return send(413, { error: 'Request is too large.' }); }
        let input;
        try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
        return send(200, target[2] === 'approval'
          ? await accountService.approveAccount(account, target[1])
          : await accountService.changeRole(account, target[1], input?.role));
      }
      const privileged = req.url.startsWith('/api/developer/') || calls || ['/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url);
      if (privileged && account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      if (developer && req.method === 'GET') return send(200, { ...listPrompts(promptsPath), editable: !hosted });
      if (comparison && req.method === 'GET') return send(200, { cases: comparisonCases, corpusVersion, savedEvaluation: readSavedQuestionEvaluation() });
      if (evaluatorComparison && req.method === 'GET') return send(200, { cases: evaluatorCases, evaluatorVersion, deferred: deferredEvaluatorWork });
      const provider = req.headers['x-feynman-provider'] || 'anthropic';
      if (hosted && (comparison || questionReview || evaluatorComparison) && provider !== 'anthropic') return send(403, { error: 'Hosted comparisons use Anthropic. Choose Anthropic in AI settings.' });
      const accounts = account.role === 'admin' ? chatgpt?.accounts() || [] : [];
      const accountId = req.headers['x-feynman-account'] || accounts.find(item => item.connected)?.id;
      const selectedModel = req.headers['x-feynman-model'] || '';
      const selection = { accountId, model: selectedModel };
      // Discovery must remain usable when a browser has saved an unavailable provider.
      if (req.method === 'GET' && req.url === '/api/ai/providers') return send(200, { providers: providers.describe(selection).filter(item => account.role === 'admin' || item.id !== 'chatgpt') });
      if (provider === 'chatgpt' && account.role !== 'admin') throw new AccountError('Local ChatGPT connections require admin access. Choose Anthropic in AI settings.', 403);
      const adapter = providers.resolve(provider, selection);
      const { configured, model } = adapter.getStatus();
      if (req.method === 'GET' && req.url === '/api/health') return send(200, { configured, provider, model, accounts, pendingRegistration: account.role === 'admin' && (chatgpt?.hasPendingRegistration?.() || false), anthropicConfigured: providers.describe(selection).some(item => item.id === 'anthropic' && item.configured) });
      if (req.method === 'GET' && req.url === '/api/ai/models') return send(200, { models: await adapter.listModels() });
      const aiControl = ['/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url);
      if (aiControl && (!req.headers.origin || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))) return send(403, { error: 'Open AI settings in the local Feynman app to manage accounts.' });
      if (req.method !== 'POST' || !['/api/chat', '/api/concepts', '/api/concept-suggestions', '/api/rubric', '/api/developer/rubric', '/api/developer/prompts', '/api/developer/question-comparison', '/api/developer/question-review', '/api/developer/evaluator-comparison', '/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url)) return send(404, { error: 'Not found' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        const limit = aiControl ? 10_000 : developer ? 200_000 : req.url === '/api/chat' || evaluatorComparison ? 12_000_000 : 7_000_000;
        if (Buffer.byteLength(body) > limit) return send(413, { error: 'Request is too large.' });
      }
      let input;
      try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return send(400, { error: 'Enter a valid request object.' });
      if (developer) return send(200, { ...savePrompt(input, promptsPath), editable: true });
      if (aiControl) {
        if (!input || Array.isArray(input) || typeof input !== 'object' || (input.accountId !== undefined && (typeof input.accountId !== 'string' || input.accountId.length > 200))) return send(400, { error: 'Choose a valid ChatGPT connection.' });
        if ((input.newRegistration !== undefined && typeof input.newRegistration !== 'boolean') || (input.newRegistration && input.accountId)) return send(400, { error: 'Choose an existing connection or add a new account.' });
        const port = server.address()?.port || Number(process.env.PORT || 3001);
        return send(200, req.url === '/api/ai/sign-in' ? await chatgpt.beginSignIn(input.accountId, `http://127.0.0.1:${port}/auth/callback`, { newRegistration: input.newRegistration === true }) : req.url === '/api/ai/remove-account' ? await chatgpt.removeAccount(input.accountId) : await chatgpt.signOut(input.accountId));
      }
      const disconnected = new AbortController();
      req.once('aborted', () => disconnected.abort());
      res.once?.('close', () => { if (!res.writableEnded) disconnected.abort(); });
      const providerQuery = query || createProviderQuery(adapter);
      const selectedQuery = (instructions, messages, response, options = {}) => providerQuery(instructions, messages, response, {
        ...options, signal: options.signal ? AbortSignal.any([options.signal, disconnected.signal]) : disconnected.signal,
      });
      const configurationError = adapter.metadata.configurationHelp;
      if (evaluatorComparison) {
        let evaluationOptions;
        try { evaluationOptions = comparisonOptions({ mode: input.mode, shadow: input.shadow }); }
        catch (error) { if (error instanceof EvaluatorInputError) return send(400, { error: error.message }); throw error; }
        const fixture = typeof input.caseId === 'string' ? evaluatorCases.find(item => item.id === input.caseId) : null;
        if (input.caseId !== undefined && !fixture) return send(400, { error: 'Choose a valid evaluator comparison case.' });
        const evaluationInput = structuredClone(fixture || input);
        // Developer run controls are not curriculum data or ordinary chat modes.
        delete evaluationInput.mode;
        delete evaluationInput.shadow;
        try { createEvaluationContext(evaluationInput); } catch (error) { if (error instanceof EvaluatorInputError) return send(400, { error: error.message }); throw error; }
        if (!configured) return send(503, { error: configurationError });
        const result = await compareEvaluators(evaluationInput, selectedQuery, loadPrompts(promptsPath), { provider, model }, evaluationOptions);
        const testCase = fixture && evaluatorTestCases.find(c => c.id === fixture.id);
        if (testCase) result.screening = screenEvaluatorComparison(testCase, result);
        return send(200, result);
      }
      if (questionReview) {
        const fixture = comparisonCases.find(item => item.id === input.caseId);
        if (!fixture) return send(400, { error: 'Choose a valid comparison case.' });
        if (typeof input.baseline !== 'string' || !input.baseline.trim() || input.baseline.length > 12000 || typeof input.enhanced !== 'string' || !input.enhanced.trim() || input.enhanced.length > 12000) return send(400, { error: 'Provide two questions of up to 12,000 characters.' });
        if (!configured) return send(503, { error: configurationError });
        return send(200, { ...await reviewQuestionPair(fixture, input.baseline, input.enhanced, selectedQuery), provider, model });
      }
      if (comparison) {
        if (!comparisonCases.some(item => item.id === input.caseId)) return send(400, { error: 'Choose a valid comparison case.' });
        if (!configured) return send(503, { error: configurationError });
        const result = await compareQuestions(input.caseId, selectedQuery, loadPrompts(promptsPath));
        return send(200, { ...result, model, provider, runId: randomUUID(), generatedAt: new Date().toISOString() });
      }
      if (req.url !== '/api/chat') {
        try { resolveLearningType(input?.learningType); } catch (error) { return send(400, { error: error.message }); }
        if (!configured) return send(503, { error: configurationError });
        try {
          if (req.url === '/api/developer/rubric') return send(200, await generateLevelRubric(input, selectedQuery, loadPrompts(promptsPath)));
          if (req.url === '/api/concept-suggestions') return send(200, { names: await suggestConceptsFromFiles(input.files, selectedQuery, input.learningType, loadPrompts(promptsPath)) });
          if (req.url === '/api/rubric') return send(200, { concepts: await generateRubric(input, selectedQuery, loadPrompts(promptsPath)) });
          return send(200, { concepts: await conceptsFromStudyTest(input, selectedQuery, loadPrompts(promptsPath)) });
        } catch (error) { return send(error instanceof InvalidOutputError ? 502 : error instanceof AIError ? error.status : /^(Upload|Choose|Enter|Could not read|Could not generate)/.test(error.message) ? 400 : /^Rubric generation took too long/.test(error.message) ? 504 : 502, { error: error.message }); }
      }
      if ('assignmentSessionId' in input || 'assignmentConceptId' in input) input = await accountService.resolveAssignment(req, input);
      try { input = validate(input); } catch (error) { return send(400, { error: error.message }); }
      if (!configured) return send(503, { error: configurationError });
      const tracedQuery = calls ? async (instructions, messages, response, options) => {
        const call = { role: ['evaluate_learning', 'evaluate_refined', 'diagnose_understanding'].includes(response.name) ? 'evaluator' : response.name === 'summarize_learning' ? 'report' : 'learner', request: structuredClone({ model, instructions, messages, response }) };
        calls.push(call);
        const started = Date.now();
        try {
          const result = await selectedQuery(instructions, messages, response, options);
          call.response = structuredClone(result);
          return result;
        } catch (error) { call.error = error.message; throw error; }
        finally { call.durationMs = Date.now() - started; }
      } : selectedQuery;
      const result = await chat(input, tracedQuery, loadPrompts(promptsPath), { evaluationCache, cacheScope: [account.id, provider, model] });
      return send(200, { ...result, ...(calls ? { calls } : {}) });
    } catch (error) { return send(error instanceof AccountError || error instanceof PromptError || error instanceof AIError ? error.status : 502, { error: error.name === 'TimeoutError' ? 'The model took too long. Please retry.' : error.message, ...(calls ? { calls } : {}) }); }
  });
  const evaluationCache = new EvaluationCache();
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
