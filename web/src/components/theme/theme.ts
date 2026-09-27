export const THEME_KEY = 'fitniti.theme'
export type ThemeName = 'light' | 'dark'

export function readTheme(): ThemeName {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* private mode and blocked storage still switch the live theme */
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'dark' ? '#0F1115' : '#F8F9FA')
}
