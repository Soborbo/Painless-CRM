import {
  GLOBAL_SEARCH_MAX_LEN,
  GLOBAL_SEARCH_MIN_LEN,
  sanitizeIlikePattern,
} from '@/lib/queries/global-search';
import { describe, expect, it } from 'vitest';

describe('sanitizeIlikePattern', () => {
  it('passes ordinary terms through unchanged', () => {
    expect(sanitizeIlikePattern('Smith')).toBe('Smith');
    expect(sanitizeIlikePattern('BS9')).toBe('BS9');
    expect(sanitizeIlikePattern('07700 900123')).toBe('07700 900123');
  });

  it('strips Postgres LIKE metacharacters that would change the match shape', () => {
    expect(sanitizeIlikePattern('%admin%')).toBe('admin');
    expect(sanitizeIlikePattern('a_b')).toBe('a b');
    expect(sanitizeIlikePattern('a,b')).toBe('a b');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeIlikePattern('   Smith  ')).toBe('Smith');
  });

  it('returns empty for an empty / whitespace-only input', () => {
    expect(sanitizeIlikePattern('')).toBe('');
    expect(sanitizeIlikePattern('   ')).toBe('');
  });
});

describe('global search bounds', () => {
  it('exposes the documented min/max length', () => {
    expect(GLOBAL_SEARCH_MIN_LEN).toBe(2);
    expect(GLOBAL_SEARCH_MAX_LEN).toBe(100);
  });
});
