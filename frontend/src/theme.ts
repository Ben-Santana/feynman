export const themes = ['light', 'dark'] as const

export type Theme = (typeof themes)[number]

export const defaultTheme: Theme = 'light'

export function setTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}
