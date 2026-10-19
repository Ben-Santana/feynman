import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { buildSignedConsent, validateConsent, sha256, agreementVersion } from './consent.js';
import { createAccountService } from './accounts.js';

const account = { id: '11111111-1111-4111-8111-111111111111', email: 'participant@example.com', role: 'student' };
const input = { signature: '  Alex Participant  ', accepted: true, agreementVersion };
test('signing binds a three-page PDF to the unchanged agreement, identity, and server timestamp', async () => {
  const now = new Date('2026-10-19T16:00:00Z');
  const record = await buildSignedConsent(account, input, now);
  const original = await readFile(new URL('../assets/informed-consent-v1.pdf', import.meta.url));
  assert.deepEqual(original, await readFile(new URL('../../frontend/public/consent/informed-consent-v1.pdf', import.meta.url)));
  assert.equal(record.signature, 'Alex Participant');
  assert.equal(record.user_id, account.id);
  assert.equal(record.email, account.email);
  assert.equal(record.signed_at, now.toISOString());
  assert.equal(record.agreement_sha256, sha256(original));
  const bytes = Buffer.from(record.pdf_base64, 'base64');
  assert.equal(record.pdf_sha256, sha256(bytes));
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
});
test('blank, malformed, outdated, and unaccepted signatures are rejected', () => {
  for (const value of [null, {}, { ...input, accepted: false }, { ...input, accepted: 'true' }, { ...input, signature: '  ' }, { ...input, signature: 'a'.repeat(101) }, { ...input, signature: 'Alex\nParticipant' }, { ...input, agreementVersion: 'old' }]) {
    assert.throws(() => validateConsent(value), error => error.status === 400);
  }
});
test('signed PDF downloads require ownership or admin access; retries cannot replace records', async () => {
  let writes = 0, reads = 0;
  const service = createAccountService({ SUPABASE_URL: 'https://example.com', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: 'secret' }, () => ({ from: () => ({
    async insert() { writes++; return { error: { code: '23505' } }; },
    select() { reads++; return this; }, eq() { return this; }, async maybeSingle() { return { data: { pdf_base64: Buffer.from('pdf').toString('base64') } }; },
  }) }));
  assert.deepEqual(await service.signConsent(account, input), { signed: true });
  assert.equal(writes, 1);
  await assert.rejects(service.downloadConsent(account, '22222222-2222-4222-8222-222222222222'), error => error.status === 403);
  assert.equal(reads, 0);
  assert.equal((await service.downloadConsent(account)).toString(), 'pdf');
  assert.equal((await service.downloadConsent({ ...account, role: 'admin' }, '22222222-2222-4222-8222-222222222222')).toString(), 'pdf');
});

test('API authorization blocks unsigned approved accounts and permits consent setup before approval', async () => {
  let signed = false, approved = true;
  const service = createAccountService({ SUPABASE_URL: 'https://example.com', SUPABASE_PUBLISHABLE_KEY: 'public' }, () => ({
    auth: { async getUser() { return { data: { user: account } }; } },
    async rpc(name) { return { data: name === 'has_signed_consent' ? signed : true }; },
    from(table) { return { select() { return this; }, eq() { return this; }, async single() { return { data: table === 'profiles' ? { ...account, approved, consent_required: true } : { role: 'student' } }; } }; },
  }));
  const request = { headers: { authorization: 'Bearer test' } };
  await assert.rejects(service.authenticate(request), error => error.status === 403 && /consent/.test(error.message));
  assert.equal((await service.authenticate(request, { allowPending: true })).consent_required, true);
  approved = false;
  assert.equal((await service.authenticate(request, { allowPending: true })).approved, false);
  signed = true;
  await assert.rejects(service.authenticate(request), /pending admin approval/);
  approved = true;
  assert.equal((await service.authenticate(request)).consent_required, false);
});
