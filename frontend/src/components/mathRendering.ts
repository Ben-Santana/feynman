import katex from 'katex'
import type { Root, RootContent } from 'hast'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'

export function repairTrailingBraces(value: string, displayMode: boolean): string {
  let candidate = value.trimEnd()
  if (!candidate.endsWith('}')) return value
  while (true) {
    try {
      katex.renderToString(candidate, { displayMode, throwOnError: true })
      return candidate === value.trimEnd() ? value : candidate
    } catch (error) {
      // Only remove trailing braces that KaTeX identifies as extra tokens.
      // Other malformed formulas must retain their original error and meaning.
      if (!(error instanceof katex.ParseError) || !error.message.includes("Expected 'EOF', got '}'") || !candidate.endsWith('}')) return value
      candidate = candidate.slice(0, -1).trimEnd()
    }
  }
}

function rehypeRepairMath() {
  return (tree: Root) => {
    function visit(node: Root | RootContent) {
      if (node.type === 'element' && node.tagName === 'code') {
        const classes = node.properties.className
        if (Array.isArray(classes) && classes.some(name => ['language-math', 'math-inline', 'math-display'].includes(String(name))) && node.children.length === 1 && node.children[0].type === 'text') {
          const text = node.children[0]
          text.value = repairTrailingBraces(text.value, !classes.includes('math-inline'))
        }
      }
      if ('children' in node) node.children.forEach(visit)
    }
    visit(tree)
  }
}

export const mathProps = { remarkPlugins: [remarkMath, remarkBreaks], rehypePlugins: [rehypeRepairMath, rehypeKatex], skipHtml: true }
