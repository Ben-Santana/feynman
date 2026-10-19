import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AccountError } from './accounts.js';

export const agreementVersion = 'informed-consent-v1';
export const electronicConsent = 'I have read the agreement, had the opportunity to ask questions, and voluntarily consent to participate. I agree to use my typed name as my electronic signature.';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateConsent(input) {
  if (input?.agreementVersion !== agreementVersion || input?.accepted !== true) throw new AccountError('Review and accept the consent agreement.', 400);
  const signature = typeof input.signature === 'string' ? input.signature.trim().normalize('NFC') : '';
  // Standard PDF fonts support Latin names; reject unsupported glyphs explicitly.
  if (!signature || [...signature].length > 100 || /[\p{C}\p{Zl}\p{Zp}]/u.test(signature)) throw new AccountError('Enter your full name using 1 to 100 characters.', 400);
  return signature;
}

export async function buildSignedConsent(account, input, now = new Date()) {
  const signature = validateConsent(input);
  const original = await readFile(new URL('../assets/informed-consent-v1.pdf', import.meta.url));
  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  try { font.encodeText(signature); } catch { throw new AccountError('Use Latin characters for your typed signature.', 400); }
  const page = pdf.getPages()[1];
  const draw = (text, x, y, maxWidth, face = font) => page.drawText(text, { x, y, font: face, size: Math.min(11, maxWidth / face.widthOfTextAtSize(text, 1)), color: rgb(.15, .15, .15) });
  draw(signature, 72, 283, 162, italic);
  draw(signature, 72, 201, 162);
  draw(now.toISOString().slice(0, 10) + ' UTC', 360, 283, 110);
  const receipt = pdf.addPage([612, 792]);
  const line = (text, y, size = 11) => receipt.drawText(text, { x: 54, y, size, font });
  line('Electronic signature record', 736, 18);
  // Wrap long names, email addresses, and hashes without overflowing the page.
  let y = 695;
  for (const text of [`Participant: ${signature}`, `Account: ${account.id}`, `Email: ${account.email}`, `Signed at: ${now.toISOString()}`, `Agreement: ${agreementVersion}`, `Original SHA-256: ${sha256(original)}`, '', electronicConsent]) {
    let segment = '';
    for (const char of text) {
      if (font.widthOfTextAtSize(segment + char, 11) > 500) { line(segment, y); y -= 18; segment = ''; }
      segment += char;
    }
    line(segment, y); y -= 24;
  }
  const bytes = await pdf.save();
  return { user_id: account.id, email: account.email, signature, signed_at: now.toISOString(), agreement_version: agreementVersion, agreement_sha256: sha256(original), electronic_consent: electronicConsent, pdf_base64: Buffer.from(bytes).toString('base64'), pdf_sha256: sha256(bytes) };
}
