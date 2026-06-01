import { type Theme, nextTheme, resolveTheme } from '@/lib/theme';
import { describe, expect, it } from 'vitest';

describe('nextTheme', () => {
  it('flips between light and dark', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });
});

describe('resolveTheme', () => {
  it('honours an explicit stored choice over the OS', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('treats an unrecognised stored value as no choice', () => {
    const stored: string = 'sepia';
    expect(resolveTheme(stored, true)).toBe('dark');
    expect(resolveTheme(stored, false)).toBe('light');
  });

  it('round-trips a toggle from the resolved state', () => {
    const start: Theme = resolveTheme(null, false); // 'light'
    expect(nextTheme(start)).toBe('dark');
  });
});
