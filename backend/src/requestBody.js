import { gunzipSync } from 'node:zlib';

export async function readRequestBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(bytes);
  }
  let bytes = Buffer.concat(chunks);
  if (req.headers['content-type']?.split(';')[0].trim() === 'application/gzip') {
    try { bytes = gunzipSync(bytes, { maxOutputLength: limit }); }
    catch (error) {
      if (error.code === 'ERR_BUFFER_TOO_LARGE') throw Object.assign(new Error('Request is too large.'), { status: 413 });
      throw Object.assign(new Error('Invalid compressed request.'), { status: 400 });
    }
  }
  return bytes.toString('utf8');
}
