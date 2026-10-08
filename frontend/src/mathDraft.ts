export type DraftPart = { start: number; end: number; text: string; latex?: string; display?: boolean }
export const messageLimit = 12000

// Keep the stored draft a string so saved sessions, traces and evaluator evidence
// retain the exact same representation as submitted messages.
export function splitMathDraft(value: string): DraftPart[] {
  const parts: DraftPart[] = []
  const equations = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$])\$(?!\$)([^$\n]+)\$(?!\$)/g
  let start = 0
  for (const match of value.matchAll(equations)) {
    const latex = match[1] ?? match[2] ?? match[3] ?? match[4]
    if (match[4] !== undefined && /^\d[\d,.]*\s+[A-Za-z]/.test(latex)) continue
    parts.push({ start, end: match.index, text: value.slice(start, match.index) })
    start = match.index + match[0].length
    parts.push({ start: match.index, end: start, text: match[0], latex, display: match[1] !== undefined || match[2] !== undefined })
  }
  parts.push({ start, end: value.length, text: value.slice(start) })
  return parts
}

export function replaceDraft(value: string, start: number, end: number, replacement: string): string {
  if (start < 0 || end < start || end > value.length) throw new Error('Choose where to insert the equation again.')
  const next = value.slice(0, start) + replacement + value.slice(end)
  if (next.length > messageLimit) throw new Error('Your message is too long. Shorten it before adding more.')
  return next
}

export function equationText(latex: string, display = false): string {
  const value = latex.trim()
  if (!value) throw new Error('Enter an equation first.')
  if (value.includes('$')) throw new Error('Enter the expression without dollar-sign delimiters.')
  return display ? `$$${value}$$` : `$${value}$`
}
