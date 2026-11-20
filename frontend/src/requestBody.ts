// Base64 adds a third to file uploads. Compress the JSON before it reaches
// the hosting platform's request limit; the API bounds the decoded body too.
export async function requestBody(value: unknown): Promise<{ body: string | Blob; contentType: string }> {
  const json = JSON.stringify(value)
  const hasFiles = value && typeof value === 'object' && 'files' in value && Array.isArray(value.files) && value.files.length > 0
  if (!hasFiles || json.length < 1_000_000) return { body: json, contentType: 'application/json' }
  const compressed = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob()
  if (compressed.size > 4_400_000) throw new Error('The upload is too large to send. Choose smaller files.')
  return { body: compressed, contentType: 'application/gzip' }
}

export async function responseData(response: Response): Promise<unknown> {
  if (response.status === 413) throw new Error('The upload is too large to send. Choose smaller files.')
  let data: { error?: string }
  try { data = await response.json() } catch { throw new Error('The server returned an unreadable response. Please retry.') }
  if (!response.ok) throw new Error(data.error || 'The request failed. Please retry.')
  return data
}
