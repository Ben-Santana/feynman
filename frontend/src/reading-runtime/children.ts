import { createElement, type ElementType, type ReactNode } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { ReadingDisabledContext, ReadingText } from '../components/ReadingText.ts'

const textOnlyElements = new Set(['input', 'textarea', 'option', 'script', 'style', 'title', 'noscript'])
const literalElements = new Set(['code', 'pre', 'kbd', 'samp', 'svg', 'math', 'math-field'])

function readingChildren(children: ReactNode, key = 'text'): ReactNode {
  if (typeof children === 'string' && /\p{L}/u.test(children)) {
    return createElement(ReadingText, { key }, children)
  }
  if (Array.isArray(children)) return children.map((child, index) => readingChildren(child, `${key}-${index}`))
  return children
}

// Transform React-owned text, including dynamically rendered labels and portals.
// Keeping this in the JSX runtime avoids DOM mutations that break reconciliation.
export function readingProps(type: ElementType, props: unknown): unknown {
  if (typeof type !== 'string' || !props || typeof props !== 'object' || !('children' in props) || textOnlyElements.has(type)) return props
  const values = props as { children: ReactNode; contentEditable?: boolean | string; className?: string; 'data-reading-ignore'?: boolean }
  if (literalElements.has(type) || values.contentEditable === true || values.contentEditable === 'true' || values.contentEditable === 'plaintext-only' ||
    values['data-reading-ignore'] || /(?:^|\s)(?:katex|reading-text)(?:\s|$)/.test(values.className ?? '')) {
    const scope = Array.isArray(values.children) ? jsxs : jsx
    return { ...props, children: scope(ReadingDisabledContext.Provider, { value: true, children: values.children }) }
  }
  return { ...props, children: readingChildren(values.children) }
}
