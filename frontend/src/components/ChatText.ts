import { createElement } from 'react'
import katex from 'katex'
import { repairTrailingBraces } from './mathRendering.ts'

type Part = { source: string; math?: string; display?: boolean }

// Recognize only unambiguous notation; ordinary prose and currency stay literal.
const automaticMath = /\b[A-Za-z]\[[A-Za-z0-9+*/() .−-]+\]|\b[A-Za-z]_(?:\{[A-Za-z0-9]+\}|[A-Za-z0-9]+)|\b\d+(?:\.\d+)?\s*∠\s*-?\d+(?:\.\d+)?°?|\b\d+\s*\/\s*\d+\b/g
function plainParts(source: string): Part[] {
  const parts: Part[] = []
  let offset = 0
  for (const match of source.matchAll(automaticMath)) {
    if (match.index > offset) parts.push({ source: source.slice(offset, match.index) })
    const math = match[0].replace(/_([A-Za-z0-9]+)/g, '_{$1}').replace('∠', '\\angle ').replace('°', '^{\\circ}').replace(/^(\d+)\s*\/\s*(\d+)$/, '\\frac{$1}{$2}')
    parts.push({ source: match[0], math })
    offset = match.index + match[0].length
  }
  if (offset < source.length) parts.push({ source: source.slice(offset) })
  return parts
}

export function chatTextParts(source: string): Part[] {
  const parts: Part[] = []
  const delimiters = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$])\$(?!\$)([^$\n]+)\$(?!\$)/g
  let offset = 0
  for (const match of source.matchAll(delimiters)) {
    parts.push(...plainParts(source.slice(offset, match.index)))
    const math = match[1] ?? match[2] ?? match[3] ?? match[4]
    // A pair of prices such as "$5 and $10" is not a math delimiter pair.
    parts.push(/^\d[\d,.]*\s+[A-Za-z]/.test(math) && match[4] !== undefined
      ? { source: match[0] }
      : { source: match[0], math, display: match[1] !== undefined || match[2] !== undefined })
    offset = match.index + match[0].length
  }
  parts.push(...plainParts(source.slice(offset)))
  return parts
}

export function ChatText({ children }: { children: string }) {
  return createElement('div', { className: 'chat-plain-text', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
    ...chatTextParts(children).map((part, index) => {
      if (!part.math) return part.source
      try {
        const html = katex.renderToString('\\displaystyle ' + repairTrailingBraces(part.math, Boolean(part.display)), { displayMode: Boolean(part.display), throwOnError: true, trust: false, strict: 'ignore' })
        return createElement('span', { key: index, className: `chat-equation${part.display ? ' chat-equation-display' : ''}`, dangerouslySetInnerHTML: { __html: html } })
      } catch { return part.source }
    }))
}
