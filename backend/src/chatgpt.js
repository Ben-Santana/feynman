import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AIError } from './providers/LanguageModelProvider.js';

const issuer = 'https://auth.openai.com';
const resource = 'https://api.openai.com/v1';
const scopes = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random = () => randomBytes(32).toString('base64url');
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

export function createSignInAttempt(hostId, redirectUri, account, registeredClientId) {
  const attempt = { state: random(), nonce: random(), verifier: random(), redirectUri, account, registeredClientId, expiresAt: Date.now() + 600_000 };
  const url = new URL(`${issuer}/api/accounts/authorize`);
  url.search = new URLSearchParams({ client_id: account?.client_id || registeredClientId || 'dynamic_agent_client', ext_agent_host_id: hostId,
    response_type: 'code', redirect_uri: redirectUri, scope: scopes, resource, state: attempt.state, nonce: attempt.nonce,
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(attempt.verifier).digest('base64url'),
    // Omit the optional ID-token hint: the authorization URL passes through the UI.
    ...(account ? { ...(account.email ? { login_hint: account.email } : {}) } : registeredClientId ? {} : { agent_name_hint: 'Feynman' }),
  }).toString();
  return { attempt, url: url.href };
}

export function createChatGPT({ directory = fileURLToPath(new URL('../.chatgpt/', import.meta.url)), fetcher = (...args) => fetch(...args), keys = jwks } = {}) {
  let saved;
  const path = join(directory, 'accounts.json');
  try { saved = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new AIError('Could not read the local ChatGPT account store.'); }
  if (saved && (typeof saved.hostId !== 'string' || !Array.isArray(saved.accounts))) throw new AIError('Invalid local ChatGPT account store.');
  const data = saved || { hostId: `urn:uuid:${randomUUID()}`, accounts: [] };
  data.attempts ||= [];
  const refreshing = new Map();
  const models = new Map();
  const signingOut = new Set();
  const persist = () => {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const temporary = join(directory, `${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(data), { mode: 0o600, flag: 'wx' });
    renameSync(temporary, path);
  };
  const account = id => {
    const value = data.accounts.find(item => item.client_id === id);
    if (!value || signingOut.has(id)) throw new AIError('Choose a saved ChatGPT account in AI settings.', 401);
    return value;
  };
  const request = async (url, options = {}) => {
    try { return await fetcher(url, { signal: AbortSignal.timeout(20_000), ...options }); }
    catch { throw new AIError('Could not reach ChatGPT. Please retry.'); }
  };
  const exchange = async fields => {
    const response = await request(`${issuer}/api/accounts/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const rawCode = typeof body?.error === 'string' ? body.error : body?.error?.code;
      const code = typeof rawCode === 'string' && /^[a-z0-9_]{1,80}$/.test(rawCode) ? rawCode : 'unknown_error';
      const requestId = response.headers.get('x-request-id');
      const reference = requestId && /^[a-zA-Z0-9_-]{1,100}$/.test(requestId) ? ` Request ID: ${requestId}.` : '';
      const description = typeof body?.error_description === 'string' ? body.error_description : typeof body?.error?.message === 'string' ? body.error.message : '';
      // Classify upstream diagnostics without printing their arbitrary text or
      // any authorization code, verifier, account identifier, or credential.
      const reason = /pkce|verifier/i.test(description) ? 'PKCE rejected'
        : /redirect/i.test(description) ? 'callback URI rejected'
        : /expir/i.test(description) ? 'code expired'
        : /already|redeem|used/i.test(description) ? 'code already consumed'
        : /not found|unknown code/i.test(description) ? 'code not found'
        : /client/i.test(description) ? 'client registration rejected' : 'unspecified';
      console.info(`Feynman OAuth exchange: HTTP ${response.status}; ${code}; reason: ${reason}.${reference}`);
      const messages = {
        invalid_grant: 'OpenAI rejected the authorization-code exchange. Start a fresh sign-in from AI settings.',
        invalid_client: 'OpenAI rejected the app registration. Sign-in could not complete.',
        rate_limit_exceeded: 'OpenAI is rate-limiting sign-in. Pause attempts and try later.',
      };
      const message = response.status === 429 ? messages.rate_limit_exceeded : messages[code] || 'OpenAI rejected the token exchange.';
      const error = new AIError(`${message} (HTTP ${response.status}; ${code}).${reference}`, response.status);
      error.oauthCode = code;
      throw error;
    }
    try { return await response.json(); } catch { throw new AIError('ChatGPT returned an invalid authorization response. Please try again.'); }
  };
  const credentials = (tokens, previous = {}) => {
    const granted = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : previous.scopes;
    if (!granted?.includes('chatgpt.tokens.use.direct')) throw new AIError('ChatGPT plan usage was not granted. Continue with ChatGPT and allow plan usage.', 403);
    if (typeof tokens.access_token !== 'string' || !tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || tokens.token_type?.toLowerCase() !== 'bearer') throw new AIError('ChatGPT returned invalid credentials. Please sign in again.');
    return { access_token: tokens.access_token, refresh_token: tokens.refresh_token || previous.refresh_token, id_token: tokens.id_token || previous.id_token,
      scopes: granted, expiresAt: Date.now() + tokens.expires_in * 1000 };
  };
  async function completeSignIn(callbackUrl, attempt) {
    const params = new URL(callbackUrl).searchParams;
    if (attempt.used || attempt.expiresAt < Date.now() || params.get('state') !== attempt.state) throw new AIError('Invalid or expired ChatGPT sign-in. Please try again.', 400);
    attempt.used = true;
    data.attempts = data.attempts.filter(item => item.state !== attempt.state);
    persist(); // Consume before exchanging; a restart cannot replay the callback.
    if (params.has('error')) throw new AIError('ChatGPT sign-in was cancelled or denied. You can try again or choose Anthropic.', 400);
    const clientId = params.get('client_id') || attempt.account?.client_id || attempt.registeredClientId;
    if (!clientId?.startsWith('oaiapp_') || (attempt.account && clientId !== attempt.account.client_id) || (attempt.registeredClientId && clientId !== attempt.registeredClientId) || !params.get('code')) throw new AIError('ChatGPT registration did not return the expected client. Please try again.', 400);
    let tokens;
    console.info(`Feynman OAuth callback: attempt age ${Math.round((Date.now() - (attempt.expiresAt - 600_000)) / 1000)}s; ${attempt.registeredClientId || attempt.account ? 'existing registration' : 'new registration'}.`);
    try {
      tokens = await exchange({ grant_type: 'authorization_code', client_id: clientId, code: params.get('code'), code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri, resource });
    } catch (error) {
      // A state-validated registration can be retried without registering another
      // agent. It is not an authenticated account until its ID token is verified.
      if (!attempt.account && error.oauthCode === 'invalid_grant') {
        data.retryClientId = clientId;
        persist();
      }
      throw error;
    }
    let payload;
    try { ({ payload } = await jwtVerify(tokens.id_token, keys, { issuer, audience: clientId, requiredClaims: ['sub', 'exp', 'nonce'], algorithms: ['RS256', 'ES256'] })); }
    catch { throw new AIError('Could not verify the ChatGPT account. Please try signing in again.', 401); }
    if (payload.nonce !== attempt.nonce || (attempt.account && (payload.sub !== attempt.account.subject || payload.iss !== attempt.account.issuer))) throw new AIError('ChatGPT returned a different account. Add it as a new connection instead.', 401);
    if (attempt.account && account(clientId).revision !== attempt.account.revision) throw new AIError('This ChatGPT connection changed during sign-in. Please start again.', 401);
    const connection = { client_id: clientId, issuer: payload.iss, subject: payload.sub, revision: randomUUID(), email: typeof payload.email === 'string' ? payload.email : '',
      label: attempt.account?.label || `Connection ${data.accounts.length + 1}`, ...credentials(tokens) };
    const index = data.accounts.findIndex(item => item.client_id === clientId);
    if (index >= 0) data.accounts[index] = connection; else data.accounts.push(connection);
    if (data.retryClientId === clientId) delete data.retryClientId;
    models.delete(clientId);
    persist();
    return clientId;
  }
  async function beginSignIn(id, redirectUri = 'http://127.0.0.1:3001/auth/callback', { newRegistration = false } = {}) {
    if (!/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/.test(redirectUri)) throw new AIError('Invalid local callback address.', 400);
    const current = id ? account(id) : undefined;
    const selected = current ? { client_id: current.client_id, email: current.email, issuer: current.issuer, subject: current.subject, label: current.label, revision: current.revision } : undefined;
    const started = createSignInAttempt(data.hostId, redirectUri, selected, !newRegistration && !id && !data.accounts.length ? data.retryClientId : undefined);
    data.attempts = data.attempts.filter(item => !item.used && item.expiresAt > Date.now()).slice(-9);
    data.attempts.push(started.attempt);
    persist(); // PKCE and nonce survive development-server restarts, never entering the UI.
    return { url: started.url };
  }
  async function handleCallback(url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new AIError('Invalid ChatGPT callback address. Please start sign-in again.', 400); }
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/auth/callback' || parsed.username || parsed.password || parsed.hash) throw new AIError('Invalid local ChatGPT callback address. Please start sign-in again.', 400);
    for (const key of ['state', 'code', 'client_id', 'error']) {
      if (parsed.searchParams.getAll(key).length > 1) throw new AIError('The ChatGPT callback contains duplicate parameters. Please start sign-in again.', 400);
    }
    const attempt = data.attempts.find(item => item.state === parsed.searchParams.get('state'));
    if (!attempt || `${parsed.origin}${parsed.pathname}` !== attempt.redirectUri) throw new AIError('Invalid or expired ChatGPT sign-in. Please try again.', 400);
    return completeSignIn(parsed.href, attempt);
  }
  async function accessToken(id) {
    const current = account(id);
    if (!current.access_token) throw new AIError('Continue with ChatGPT in AI settings to reconnect this account.', 401);
    if (current.expiresAt > Date.now() + 60_000) return current.access_token;
    if (!current.refresh_token) throw new AIError('ChatGPT access expired. Continue with ChatGPT again in AI settings.', 401);
    if (!refreshing.has(id)) refreshing.set(id, (async () => {
      const tokens = await exchange({ grant_type: 'refresh_token', client_id: id, refresh_token: current.refresh_token, resource });
      if (account(id) !== current) throw new AIError('The ChatGPT connection changed. Please retry.', 401);
      Object.assign(current, credentials(tokens, current));
      persist();
      return current.access_token;
    })().finally(() => refreshing.delete(id)));
    return refreshing.get(id);
  }
  async function listModels(id) {
    const token = await accessToken(id);
    const cached = models.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.values;
    const response = await request(`${resource}/models`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new AIError(response.status === 401 ? 'ChatGPT access expired or was revoked. Continue with ChatGPT again in AI settings.' : response.status === 429 ? 'Your ChatGPT plan usage limit was reached. Please retry later.' : `Could not list ChatGPT models (${response.status}). Check AI settings.`, response.status === 401 || response.status === 403 || response.status === 429 ? response.status : 502);
    const catalog = await response.json();
    const values = catalog.models?.filter(item => item.visibility === 'list' && typeof item.slug === 'string').map(item => ({ slug: item.slug, name: item.display_name || item.slug }));
    if (!values?.length) throw new AIError('No ChatGPT models are available for this account. Check its plan and workspace permissions.', 403);
    models.set(id, { values, expiresAt: Date.now() + 300_000 });
    return values;
  }
  async function signOut(id) {
    const current = account(id);
    signingOut.add(id);
    current.revision = randomUUID();
    data.attempts = data.attempts.filter(item => item.account?.client_id !== id);
    persist();
    let revoked = !current.refresh_token;
    try {
      if (current.refresh_token) {
        const discovery = await request(`${issuer}/.well-known/openid-configuration`);
        if (!discovery.ok) throw new Error('Discovery failed');
        const config = await discovery.json();
        const endpoint = new URL(config.revocation_endpoint);
        if (endpoint.origin !== issuer) throw new Error('Invalid revocation endpoint');
        for (let tries = 0; tries < 2; tries++) {
          const response = await request(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: current.refresh_token, token_type_hint: 'refresh_token', client_id: id }).toString() });
          revoked = response.status === 200;
          if (revoked || response.status < 500) break;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch { /* Local sign-out still completes if remote revocation is unavailable. */ }
    finally {
      for (const key of ['access_token', 'refresh_token', 'id_token', 'scopes', 'expiresAt']) delete current[key];
      models.delete(id); signingOut.delete(id); persist();
    }
    return { revoked, message: revoked ? 'Signed out of ChatGPT.' : 'Signed out locally. Remote revocation was not confirmed; disconnect Feynman in ChatGPT settings.' };
  }
  async function removeAccount(id) {
    const result = await signOut(id);
    data.accounts = data.accounts.filter(item => item.client_id !== id);
    persist();
    return { ...result, message: result.revoked ? 'Account removed.' : 'Account removed locally. Remote revocation was not confirmed; disconnect Feynman in ChatGPT settings.' };
  }
  return { beginSignIn, completeSignIn, handleCallback, accessToken, listModels, signOut, removeAccount,
    hasPendingRegistration: () => Boolean(data.retryClientId),
    accounts: () => data.accounts.map(item => ({ id: item.client_id, label: item.label, email: item.email, revision: item.revision || '', connected: Boolean(item.access_token && item.scopes?.includes('chatgpt.tokens.use.direct')) })),
    close: () => {},
  };
}

