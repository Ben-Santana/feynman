// Landing page contact form: input validation and a per-client rate limit.

export const contactLimits = { name: 100, email: 254, message: 4000 };
export const defaultContactInbox = 'basantana@wpi.edu';

const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const text = value => typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(controlCharacters, '').trim() : '';

/**
 * Returns `{ error }` for input the visitor must fix, `{ spam: true }` when the hidden
 * field was filled in (answered as success so bots learn nothing), or `{ value }`.
 */
export function parseContactMessage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Fill in your name, email, and message.' };
  if (text(input.website)) return { spam: true };
  const name = text(input.name).replace(/\s+/g, ' ');
  const email = text(input.email).toLowerCase();
  const message = text(input.message);
  if (!name) return { error: 'Enter your name.' };
  if (name.length > contactLimits.name) return { error: `Keep your name under ${contactLimits.name} characters.` };
  if (email.length > contactLimits.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (!message) return { error: 'Write a message.' };
  if (message.length > contactLimits.message) return { error: `Keep your message under ${contactLimits.message} characters.` };
  return { value: { name, email, message } };
}

export function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  return {
    /** Records an attempt and reports whether it is within the limit. */
    take(key) {
      const time = now();
      const recent = (hits.get(key) || []).filter(at => time - at < windowMs);
      if (hits.size > 5000) for (const [entry, times] of hits) if (!times.some(at => time - at < windowMs)) hits.delete(entry);
      if (recent.length >= limit) { hits.set(key, recent); return false; }
      recent.push(time);
      hits.set(key, recent);
      return true;
    },
  };
}

export function clientAddress(req, hosted) {
  // Vercel sets x-forwarded-for; locally the header could be forged, so use the socket.
  const forwarded = hosted ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

// Landing page contributors, keyed by the slug the page uses. Emails stay on the server.
export const contributorEmails = { koksal: 'kmus@wpi.edu', leo: 'shraybmanleo@gmail.com', ben: 'basantana@wpi.edu' };
