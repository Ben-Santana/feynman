import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Temporary shared access gate. Replace this secret to invalidate every session.
const temporarySecret = 'b955a72fd6ce22e494f9ecade8c1ad0c409448bad9c02ee619cf3fb7c3e96137';
const cookieName = 'feynman_access';
const lifetime = 60 * 60 * 24 * 7;
export function createAccessGate(env = process.env, hosted = false) {
  const secret = env.ACCESS_SESSION_SECRET || temporarySecret;
  const sign = value => createHmac('sha256', secret).update(value).digest('base64url');
  const attempts = new Map();
  function valid(req) {
    const token = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token) return false;
    const [expires, nonce, signature, extra] = token.split('.');
    if (extra || !expires || !nonce || !signature || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) return false;
    const expected = Buffer.from(sign(`${expires}.${nonce}`));
    const actual = Buffer.from(signature);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  async function handle(req, res, send) {
    if (req.url === '/api/access' && req.method === 'GET') { send(200, { unlocked: valid(req) }); return true; }
    if (req.url !== '/api/access' || req.method !== 'POST') return false;
    const key = req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    for (const [ip, attempt] of attempts) if (attempt.until <= now) attempts.delete(ip);
    const attempt = attempts.get(key) || { count: 0, until: now + 60_000 };
    if (attempt.count >= 10) { send(429, { error: 'Try again shortly.' }); return true; }
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 100) { send(413, { error: 'Request is too large.' }); return true; } }
    let code;
    try { code = JSON.parse(body)?.code; } catch { send(400, { error: 'Invalid JSON request.' }); return true; }
    if (code !== '6767') {
      attempt.count += 1; attempts.set(key, attempt);
      send(401, { unlocked: false }); return true;
    }
    attempts.delete(key);
    const value = `${now + lifetime * 1000}.${randomBytes(16).toString('hex')}`;
    res.setHeader('Set-Cookie', `${cookieName}=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${lifetime}${hosted ? '; Secure' : ''}`);
    send(200, { unlocked: true }); return true;
  }
  return { valid, handle };
}
