import { createElement } from 'react'
import katex from 'katex'
import { ReadingText } from './ReadingText.ts'
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

function PlainChatText({ children = '' }: { children?: string }) {
  return createElement('div', { className: 'chat-plain-text', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
    ...chatTextParts(children).map((part, index) => {
      if (!part.math) return createElement(ReadingText, { key: index }, part.source)
      try {
        const html = katex.renderToString('\\displaystyle ' + repairTrailingBraces(part.math, Boolean(part.display)), { displayMode: Boolean(part.display), throwOnError: true, trust: false, strict: 'ignore' })
        return createElement('span', { key: index, className: `chat-equation${part.display ? ' chat-equation-display' : ''}`, dangerouslySetInnerHTML: { __html: html } })
      } catch { return createElement(ReadingText, { key: index }, part.source) }
    }))
}

export function chatTableBlocks(source: string): (string | string[][])[] {
  const lines = source.split('\n'), blocks: (string | string[][])[] = []
  let plain: string[] = []
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'))
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim().startsWith('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1]?.trim() || '')) {
      if (plain.length) { blocks.push(plain.join('\n')); plain = [] }
      const rows = [cells(lines[index])]
      index++
      while (lines[index + 1]?.trim().startsWith('|')) rows.push(cells(lines[++index]))
      blocks.push(rows)
    } else plain.push(lines[index])
  }
  if (plain.length) blocks.push(plain.join('\n'))
  return blocks
}

export function ChatText({ children }: { children: string }) {
  const blocks = chatTableBlocks(children)
  if (!blocks.some(Array.isArray)) return createElement(PlainChatText, null, children)
  return createElement('div', null, ...blocks.map((block, index) => typeof block === 'string'
    ? createElement(PlainChatText, { key: index }, block)
    : createElement('div', { className: 'chat-table-scroll', key: index, tabIndex: 0, role: 'region', 'aria-label': 'Scenario data' },
      createElement('table', { className: 'chat-data-table' },
        createElement('thead', null, createElement('tr', null, ...block[0].map((cell, i) => createElement('th', { key: i, scope: 'col' }, createElement(PlainChatText, null, cell))))),
        createElement('tbody', null, ...block.slice(1).map((row, i) => createElement('tr', { key: i }, ...row.map((cell, j) => createElement('td', { key: j }, createElement(PlainChatText, null, cell))))))))))
}
