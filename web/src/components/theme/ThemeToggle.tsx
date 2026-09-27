import { useState } from 'react'
import { Icon } from '@/components/ui'
import { applyTheme, readTheme, type ThemeName } from '@/components/theme/theme'

/** Header control. Preference is stored in localStorage and applied on <html data-theme>. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(() => readTheme())
  const next: ThemeName = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      aria-label={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={next === 'dark' ? 'Dark mode' : 'Light mode'}
      onClick={() => {
        applyTheme(next)
        setTheme(next)
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink-900 text-slate-400 transition hover:bg-ink-800 hover:text-fg"
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
    </button>
  )
}
