// Day/night theme helpers. The actual palette swap is CSS-only
// (see globals.css: :root.dark / :root.light). These pure helpers keep the
// toggle logic testable; the DOM/localStorage writes live in the client
// component (components/layout/theme-toggle.tsx).

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

// What theme is in effect, given the stored preference and the OS setting.
// An explicit stored choice wins; otherwise we follow the OS.
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDark ? 'dark' : 'light';
}
