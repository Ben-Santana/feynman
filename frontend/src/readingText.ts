import type { Root, RootContent } from 'hast'

export type ReadingPart = { text: string; bold?: boolean }
export function readingParts(text: string): ReadingPart[] {
  const parts: ReadingPart[] = []
  let offset = 0
  for (const match of text.matchAll(/\p{L}[\p{L}\p{M}]*/gu)) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index) })
    // Keep combining marks attached to their letter when dividing a word.
    const letters = match[0].match(/\p{L}\p{M}*/gu)!
    const prefix = letters.length > 1 ? Math.ceil(letters.length / 2) : 0
    if (prefix) parts.push({ text: letters.slice(0, prefix).join(''), bold: true })
    parts.push({ text: letters.slice(prefix).join('') })
    offset = match.index + match[0].length
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) })
  return parts
}

export function emphasizeReadingTree(tree: Root) {
  function visit(node: Root | RootContent) {
    if (node.type === 'element') {
      const classes = node.properties.className
      if (['code', 'pre', 'math', 'svg', 'strong', 'b'].includes(node.tagName) ||
        (Array.isArray(classes) && classes.some(name => /^(katex|math)/.test(String(name))))) return
    }
    if (!('children' in node)) return
    node.children = node.children.flatMap((child): RootContent[] => child.type === 'text'
      ? readingParts(child.value).map(part => part.bold
        ? { type: 'element', tagName: 'b', properties: { className: ['reading-word-start'] }, children: [{ type: 'text', value: part.text }] }
        : { type: 'text', value: part.text })
      : (visit(child), [child])) as typeof node.children
  }
  visit(tree)
}
