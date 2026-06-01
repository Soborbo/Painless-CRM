'use client';

import { THEME_STORAGE_KEY, type Theme, nextTheme, resolveTheme } from '@/lib/theme';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

function readCurrentTheme(): Theme {
  const c = document.documentElement.classList;
  if (c.contains('dark')) return 'dark';
  if (c.contains('light')) return 'light';
  return resolveTheme(null, window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function ThemeToggle() {
  const t = useTranslations('theme');
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Sync state with whatever the no-FOUC bootstrap script (or the OS) settled
  // on. Until mounted we render a neutral icon so SSR and the client agree.
  useEffect(() => {
    setTheme(readCurrentTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next = nextTheme(theme);
    const c = document.documentElement.classList;
    c.remove('light', 'dark');
    c.add(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage may be blocked (private mode) — the class still applies for this session
    }
    setTheme(next);
  }

  const label = theme === 'dark' ? t('switchToLight') : t('switchToDark');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded-[3px] border border-current/25 px-2 py-1.5 text-xs outline-none transition-colors hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      <span aria-hidden>{!mounted ? '🌓' : theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
