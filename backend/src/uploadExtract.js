import { inflateRawSync } from 'node:zlib';

// Read the central directory rather than local headers so Office archives with data descriptors work.
export function extractArchiveText(bytes) {
  const footer = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (footer < 0 || footer + 22 > bytes.length) throw new Error('Could not read this archive.');
  const count = bytes.readUInt16LE(footer + 10);
  let offset = bytes.readUInt32LE(footer + 16);
  const parts = [];
  let total = 0;
  for (let index = 0; index < count && total < 100000; index++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Could not read this archive.');
    const method = bytes.readUInt16LE(offset + 10);
    const size = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;
    if (!/^(word\/(document|header\d*|footer\d*)\.xml|ppt\/slides\/slide\d+\.xml|xl\/(sharedStrings|worksheets\/sheet\d+)\.xml|content\.xml|OEBPS\/.*\.(xhtml|html)|.*\.(txt|md|csv))$/i.test(name) || size > 2_000_000 || uncompressed > 1_000_000) continue;
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) continue;
    const dataStart = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (dataStart + size > bytes.length) continue;
    const compressed = bytes.subarray(dataStart, dataStart + size);
    const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 1_000_000 }) : null;
    if (!content) continue;
    const raw = content.toString('utf8');
    const text = /\.xml$|\.x?html$/i.test(name) ? raw.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : raw;
    parts.push(`${name}: ${text}`);
    total += text.length;
  }
  if (!parts.length) throw new Error('Could not read text from this archive. Try a PDF, image, Office file, or text-based file.');
  return parts.join('\n').slice(0, 50000);
}
