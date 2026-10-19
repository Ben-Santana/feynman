import { jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime'
import { readingProps } from './children.ts'
export { Fragment } from 'react/jsx-dev-runtime'
export type { JSX } from 'react/jsx-dev-runtime'

export const jsxDEV: typeof reactJsxDEV = (type, props, key, isStatic, source, self) => {
  const next = readingProps(type, props)
  return reactJsxDEV(type, next, key, isStatic && Array.isArray((next as { children?: unknown })?.children), source, self)
}
