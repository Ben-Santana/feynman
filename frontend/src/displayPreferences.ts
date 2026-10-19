import { defaultTheme, setTheme, type Theme } from './theme.ts'

export const fontSizes = ['small', 'default', 'large', 'extra-large'] as const
export const fontFamilies = ['default', 'sans', 'serif'] as const
export type DisplayPreferences = {
  theme: Theme
  fontSize: typeof fontSizes[number]
  fontFamily: typeof fontFamilies[number]
  boldWordStarts: boolean
}
export const displayStorageKey = 'feynman-display'
export const defaultDisplayPreferences: DisplayPreferences = {
  theme: defaultTheme, fontSize: 'default', fontFamily: 'default', boldWordStarts: false,
}
const scales = { small: 90, default: 100, large: 115, 'extra-large': 130 }
let preferences = defaultDisplayPreferences
const listeners = new Set<() => void>()

export function parseDisplayPreferences(value: string | null): DisplayPreferences {
  try {
    const saved = JSON.parse(value ?? '{}')
    return {
      theme: saved?.theme === 'dark' ? 'dark' : defaultTheme,
      fontSize: fontSizes.includes(saved?.fontSize) ? saved.fontSize : 'default',
      fontFamily: fontFamilies.includes(saved?.fontFamily) ? saved.fontFamily : 'default',
      boldWordStarts: saved?.boldWordStarts === true,
    }
  } catch { return { ...defaultDisplayPreferences } }
}

export const getDisplayPreferences = () => preferences
export function subscribeDisplayPreferences(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function applyPreferences(next: DisplayPreferences) {
  preferences = next
  setTheme(next.theme)
  document.documentElement.style.fontSize = `${scales[next.fontSize]}%`
  document.documentElement.dataset.fontFamily = next.fontFamily
  listeners.forEach(listener => listener())
}
export function updateDisplayPreferences(patch: Partial<DisplayPreferences>) {
  const next = { ...preferences, ...patch }
  applyPreferences(next)
  try { localStorage.setItem(displayStorageKey, JSON.stringify(next)); return true }
  catch { return false }
}
export function initializeDisplayPreferences() {
  let saved: string | null = null
  try { saved = localStorage.getItem(displayStorageKey) } catch { /* Keep controls usable without storage. */ }
  applyPreferences(parseDisplayPreferences(saved))
  window.addEventListener('storage', event => {
    if (event.key === displayStorageKey || event.key === null) {
      try {
        if (event.storageArea === window.localStorage) applyPreferences(parseDisplayPreferences(event.newValue))
      } catch { /* Storage may be unavailable in restricted browsers. */ }
    }
  })
}
