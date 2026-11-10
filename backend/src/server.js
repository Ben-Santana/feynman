import { createStudyGuidanceGenerator } from './studyGuidance.js';
import { usageFeatures, usageRecord } from './usage.js';
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
import { generatePuzzle, puzzlePrompt, validatePuzzleDescription } from './puzzleGeneration.js';

const evaluatorCases = evaluatorComparisonCases;

export function createApiServer({ query, hosted = false, env = process.env, promptsPath = promptFile, chatgpt = hosted ? null : createChatGPT(), providers = createProviderRegistry({ chatgpt, env }), accountService = createAccountService(env) } = {}) {
  const generateStudyGuidance = createStudyGuidanceGenerator();
  const claudeSelection = async () => ({ model: hosted ? await accountService.getClaudeModel() : '' });
  const allowedOrigins = hosted
    ? [env.APP_ORIGIN, ...[env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`)].filter(Boolean).map(origin => new URL(origin).origin)
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
    const calls = req.url === '/api/chat' && req.headers['x-feynman-trace'] === '1' ? [] : null;
    const developer = req.url === '/api/developer/prompts';
    const puzzleGeneration = req.url === '/api/developer/puzzles';
    const comparison = req.url === '/api/developer/question-comparison';
    const questionReview = req.url === '/api/developer/question-review';
    const evaluatorComparison = req.url === '/api/developer/evaluator-comparison';
    const callbackRequest = req.url === '/auth/callback' || req.url.startsWith('/auth/callback?');
    if (callbackRequest) console.info('Feynman ChatGPT callback: HTTP request received.');
    // Hosted instances cannot persist local OAuth credentials or source edits.
    if (hosted && developer && req.method !== 'GET') return send(403, { error: 'Prompts are read-only on this deployment. Use the local Feynman app to edit them.' });
    const aiControl = ['/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url?.split('?')[0]);
    if ((hosted || !chatgpt) && (callbackRequest || aiControl)) return send(403, { error: 'ChatGPT connections require the local Feynman app.' });
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
      if (url.pathname === '/api/account' && req.method === 'GET') return send(200, { ...account, hosted });
      const studyGuidanceRoute = /^\/api\/sessions\/([^/]+)\/report\/guidance$/.exec(url.pathname);
      if (studyGuidanceRoute && req.method === 'GET') {
        if (!accountService.topicReports) throw new AccountError('Topic reports are not configured.', 503);
        const saved = await accountService.topicReports.report(account, studyGuidanceRoute[1], { snapshotId: url.searchParams.get('snapshot') || undefined });
        const adapter = providers.resolve('anthropic', await claudeSelection());
        if (!query && !adapter.getStatus().configured) throw new AIError('Configure the Anthropic API key to generate your study summary.', 503);
        const claudeQuery = query || createProviderQuery(adapter);
        const guidanceQuery = (instructions, messages, response, options = {}) => claudeQuery(instructions, messages, response, { ...options, onUsage: async ({ model, usage }) => {
          try { await accountService.recordUsage?.(usageRecord({ userId: account.id, feature: 'Study summaries', operation: response.name, provider: 'anthropic', model: model || adapter.getStatus().model, usage })); }
          catch { console.error('Could not save study summary usage.'); }
        } });
        return send(200, await generateStudyGuidance(account.id, saved.report, guidanceQuery, adapter.getStatus().model));
      }
      const topicReport = /^\/api\/sessions\/([^/]+)\/report$/.exec(url.pathname);
      if (topicReport && ['GET', 'POST'].includes(req.method)) {
        if (!accountService.topicReports) throw new AccountError('Topic reports are not configured.', 503);
        return send(200, await accountService.topicReports.report(account, topicReport[1], {
          save: req.method === 'POST', mode: url.searchParams.get('mode') || 'early', snapshotId: url.searchParams.get('snapshot') || undefined,
        }));
      }
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
      if (req.method === 'GET' && url.pathname === '/api/inbox') return send(200, await accountService.inbox(account, url.searchParams));
      if (url.pathname.startsWith('/api/admin/')) {
        if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
        if (url.pathname === '/api/admin/ai-model') {
          if (!hosted) return send(404, { error: 'Not found' });
          const claude = providers.resolve('anthropic');
          const defaultModel = claude.getStatus().model;
          if (req.method === 'GET') {
            const [{ model }, models] = await Promise.all([claudeSelection(), claude.listModels()]);
            return send(200, { model, defaultModel, models });
          }
          if (req.method !== 'PATCH') return send(404, { error: 'Not found' });
          let body = '';
          for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 1000) return send(413, { error: 'Request is too large.' }); }
          let input;
          try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
          const model = input?.model;
          if (typeof model !== 'string' || (model !== '' && (!/^claude-[a-z0-9-]{1,120}$/.test(model) || !(await claude.listModels()).some(item => item.slug === model)))) {
            return send(400, { error: 'Choose an available Claude model.' });
          }
          await accountService.setClaudeModel(account, model);
          return send(200, { model });
        }
        if (url.pathname === '/api/admin/research/export' && req.method === 'GET') {
          const file = await accountService.topicReports.export(account, url.searchParams);
          res.setHeader('Content-Type', file.type);
          res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.writeHead(200); return res.end(file.content);
        }
        if (url.pathname === '/api/admin/usage' && req.method === 'GET') return send(200, await accountService.usageAnalytics(account, url.searchParams));
        if (url.pathname === '/api/admin/courses' && req.method === 'GET') return send(200, await accountService.listCourses(account, url.searchParams));
        const courseTarget = /^\/api\/admin\/courses\/([^/]+)$/.exec(url.pathname);
        if (courseTarget && req.method === 'GET') return send(200, await accountService.viewCourse(account, courseTarget[1]));
        if (url.pathname === '/api/admin/users' && req.method === 'GET') return send(200, await accountService.listUsers(account, url.searchParams));
        const deleteTarget = /^\/api\/admin\/users\/([^/]+)$/.exec(url.pathname);
        if (deleteTarget && req.method === 'DELETE') return send(200, await accountService.deleteAccount(account, deleteTarget[1]));
        const target = /^\/api\/admin\/users\/([^/]+)\/(role|approval|points)$/.exec(url.pathname);
        if (!target || req.method !== (target[2] === 'points' ? 'POST' : 'PATCH')) return send(404, { error: 'Not found' });
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 1000) return send(413, { error: 'Request is too large.' }); }
        let input;
        try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
        if (target[2] === 'points') return send(200, await accountService.grantPoints(account, target[1], input?.points));
        return send(200, target[2] === 'approval'
          ? await accountService.approveAccount(account, target[1])
          : await accountService.changeRole(account, target[1], input?.role));
      }
      const privileged = req.url.startsWith('/api/developer/') || calls;
      if (privileged && account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      if (puzzleGeneration && req.method === 'GET') return send(200, puzzlePrompt());
      if (developer && req.method === 'GET') return send(200, { ...listPrompts(promptsPath), editable: !hosted });
      if (comparison && req.method === 'GET') return send(200, { cases: comparisonCases, corpusVersion, savedEvaluation: readSavedQuestionEvaluation() });
      if (evaluatorComparison && req.method === 'GET') return send(200, { cases: evaluatorCases, evaluatorVersion, deferred: deferredEvaluatorWork });
      if (hosted && url.pathname.startsWith('/api/ai/') && account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      const provider = hosted ? 'anthropic' : req.headers['x-feynman-provider'] || 'anthropic';
      const accounts = hosted ? [] : chatgpt?.accounts() || [];
      const selection = hosted ? await claudeSelection() : {
        accountId: req.headers['x-feynman-account'] || accounts.find(item => item.connected)?.id,
        model: req.headers['x-feynman-model'] || '',
      };
      // Discovery must remain usable when a browser has saved an unavailable provider.
      if (req.method === 'GET' && req.url === '/api/ai/providers') return send(200, { providers: providers.describe(selection).filter(item => !hosted || item.id === 'anthropic') });
      const adapter = providers.resolve(provider, selection);
      const { configured, model } = adapter.getStatus();
      if (req.method === 'GET' && req.url === '/api/health') return send(200, { configured, provider, model, accounts, pendingRegistration: !hosted && (chatgpt?.hasPendingRegistration?.() || false), anthropicConfigured: providers.resolve('anthropic').getStatus().configured });
      if (req.method === 'GET' && req.url === '/api/ai/models') return send(200, { models: await adapter.listModels() });
      if (aiControl && (!req.headers.origin || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))) return send(403, { error: 'Open AI settings in the local Feynman app to manage accounts.' });
      if (req.method !== 'POST' || !['/api/chat', '/api/concepts', '/api/concept-suggestions', '/api/rubric', '/api/developer/rubric', '/api/developer/prompts', '/api/developer/question-comparison', '/api/developer/question-review', '/api/developer/evaluator-comparison', '/api/developer/puzzles', '/api/ai/sign-in', '/api/ai/sign-out', '/api/ai/remove-account'].includes(req.url)) return send(404, { error: 'Not found' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        const limit = puzzleGeneration ? 40_000 : aiControl ? 10_000 : developer ? 200_000 : req.url === '/api/chat' || evaluatorComparison ? 12_000_000 : 7_000_000;
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
      const operationModels = new Map();
      const selectedQuery = (instructions, messages, response, options = {}) => providerQuery(instructions, messages, response, {
        ...options, onUsage: async ({ model: actualModel, usage }) => {
          if (actualModel) operationModels.set(response.name, actualModel);
          try { await accountService.recordUsage?.(usageRecord({ userId: account.id, feature: usageFeatures[url.pathname] || 'Other AI requests', operation: response.name, provider, model: actualModel || model, usage })); }
          catch { console.error('Could not save AI usage. Check the usage migration and Supabase service configuration.'); }
        }, signal: options.signal ? AbortSignal.any([options.signal, disconnected.signal]) : disconnected.signal,
      });
      const configurationError = adapter.metadata.configurationHelp;
      if (puzzleGeneration) {
        try { validatePuzzleDescription(input); } catch (error) { return send(400, { error: error.message }); }
        if (!configured) return send(503, { error: configurationError });
        return send(200, await generatePuzzle(input, selectedQuery, { provider, model }));
      }
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
          if (req.url === '/api/concept-suggestions') return send(200, { concepts: await suggestConceptsFromFiles(input.files, selectedQuery, input.learningType, loadPrompts(promptsPath)) });
          if (req.url === '/api/rubric') return send(200, { concepts: await generateRubric(input, selectedQuery, loadPrompts(promptsPath)) });
          return send(200, { concepts: await conceptsFromStudyTest(input, selectedQuery, loadPrompts(promptsPath)) });
        } catch (error) { return send(error instanceof InvalidOutputError ? 502 : error instanceof AIError ? error.status : /^(Upload|Choose|Enter|Could not read|Could not generate)/.test(error.message) ? 400 : /^Rubric generation took too long/.test(error.message) ? 504 : 502, { error: error.message }); }
      }
      if ('assignmentSessionId' in input || 'assignmentConceptId' in input) input = await accountService.resolveAssignment(req, input);
      // The flag and evaluator metadata are internal, never client policy.
      delete input.researchScoring;
      delete input.evaluatorCriteria;
      let prepared;
      if (accountService.topicReports && (input.assignmentSessionId || input.sessionId)) {
        prepared = await accountService.topicReports.prepare(account, input);
        input = prepared.input;
      }
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
      let assessmentRecord;
      const prompts = loadPrompts(promptsPath);
      const result = await chat(input, tracedQuery, prompts, { evaluationCache, cacheScope: [account.id, provider, model],
        persistedAssessment: prepared?.previous?.payload.assessment,
        openSkips: prepared?.openSkips,
        onAssessment: prepared ? async assessment => {
          assessmentRecord = await accountService.topicReports.record(account, prepared, assessment, { provider, model: operationModels.get('evaluate_refined') || model, prompt: prompts.version });
          if (assessment.complete || assessment.readyToAdvance) await accountService.topicReports.report?.(account, prepared.sessionId, { save: true, mode: 'completed', onlyIfComplete: true });
        } : undefined,
      });
      return send(200, { ...result, ...(assessmentRecord ? { assessmentRecord: { id: assessmentRecord.id, sequence: assessmentRecord.sequence, goals: assessmentRecord.payload.goals } } : {}), ...(calls ? { calls } : {}) });
    } catch (error) {
      console.error('Feynman API request failed', { method: req.method, error });
      return send(error instanceof AccountError || error instanceof PromptError || error instanceof AIError ? error.status : 502, { error: error.name === 'TimeoutError' ? 'The model took too long. Please retry.' : error.message, ...(calls ? { calls } : {}) }); }
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
// Development reloads send SIGTERM. Keep accepting requests until current work
// finishes, then release the port so the launcher can start the new source.
export function installGracefulShutdown(server, { signals = process, exit = code => process.exit(code), graceMs = 240_000, log = console.info } = {}) {
  const active = new Set();
  let requested = false, closing = false, finished = false, deadline;
  function complete(code) {
    if (finished) return;
    finished = true; clearTimeout(deadline); exit(code);
  }
  function closeWhenIdle() {
    if (!requested || closing || active.size) return;
    closing = true;
    server.close(() => complete(0));
    server.closeIdleConnections?.();
  }
  function track(_req, res) {
    active.add(res);
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true; active.delete(res); closeWhenIdle();
    };
    res.once('finish', settle); res.once('close', settle);
  }
  function force() {
    closing = true;
    server.close(); server.closeAllConnections?.(); complete(1);
  }
  function shutdown() {
    if (requested) { force(); return; }
    requested = true;
    if (active.size) log(`Feynman API: waiting for ${active.size} active request${active.size === 1 ? '' : 's'} before shutdown.`);
    deadline = setTimeout(force, graceMs); deadline.unref?.();
    closeWhenIdle();
  }
  server.prependListener('request', track);
  signals.on('SIGTERM', shutdown); signals.on('SIGINT', shutdown);
  return () => {
    clearTimeout(deadline); server.removeListener('request', track);
    signals.removeListener('SIGTERM', shutdown); signals.removeListener('SIGINT', shutdown);
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  const server = createApiServer();
  installGracefulShutdown(server);
  server.listen(port, '127.0.0.1', () => console.log(`Feynman API: http://127.0.0.1:${port}`));
}
