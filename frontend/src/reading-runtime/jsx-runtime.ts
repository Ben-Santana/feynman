import { jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime'
import { readingProps } from './children.ts'
export { Fragment } from 'react/jsx-runtime'
export type { JSX } from 'react/jsx-runtime'

export const jsx: typeof reactJsx = (type, props, key) => reactJsx(type, readingProps(type, props), key)
export const jsxs: typeof reactJsxs = (type, props, key) => {
  const next = readingProps(type, props)
  return (Array.isArray((next as { children?: unknown })?.children) ? reactJsxs : reactJsx)(type, next, key)
}
