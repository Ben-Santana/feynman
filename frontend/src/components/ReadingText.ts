import { createContext, createElement, useContext } from 'react'
import { readingParts } from '../readingText.ts'
import { useDisplayPreferences } from '../useDisplayPreferences.ts'

export const ReadingDisabledContext = createContext(false)

export function ReadingText({ children = '' }: { children?: string }) {
  const { boldWordStarts } = useDisplayPreferences()
  const disabled = useContext(ReadingDisabledContext)
  if (!boldWordStarts || disabled) return children
  // One inline container keeps word fragments together inside flex buttons.
  return createElement('span', { className: 'reading-text' }, ...readingParts(children).map((part, index) => part.bold
    ? createElement('b', { key: index, className: 'reading-word-start' }, part.text)
    : part.text))
}
