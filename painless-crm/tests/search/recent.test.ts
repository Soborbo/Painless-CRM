import { MAX_RECENT_SEARCHES, addRecentSearch, parseRecentSearches } from '@/lib/search/recent';
import { describe, expect, it } from 'vitest';

describe('addRecentSearch', () => {
  it('prepends a new term', () => {
    expect(addRecentSearch(['BS9'], 'Smith')).toEqual(['Smith', 'BS9']);
  });

  it('trims the term and ignores a blank one', () => {
    expect(addRecentSearch(['BS9'], '  Smith  ')).toEqual(['Smith', 'BS9']);
    expect(addRecentSearch(['BS9'], '   ')).toEqual(['BS9']);
  });

  it('bumps an existing term to the top without duplicating (case-insensitive)', () => {
    expect(addRecentSearch(['BS9', 'Smith'], 'smith')).toEqual(['smith', 'BS9']);
  });

  it('caps the list at MAX_RECENT_SEARCHES', () => {
    const long = ['a', 'b', 'c', 'd', 'e'];
    const out = addRecentSearch(long, 'f');
    expect(out).toHaveLength(MAX_RECENT_SEARCHES);
    expect(out[0]).toBe('f');
    expect(out).not.toContain('e');
  });

  it('does not mutate the input list', () => {
    const input = ['BS9'];
    addRecentSearch(input, 'Smith');
    expect(input).toEqual(['BS9']);
  });
});

describe('parseRecentSearches', () => {
  it('returns an empty list for non-array input', () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches('Smith')).toEqual([]);
    expect(parseRecentSearches(undefined)).toEqual([]);
  });

  it('keeps clean string entries, trimming and dropping blanks', () => {
    expect(parseRecentSearches(['Smith', '  BS9 ', '', '  '])).toEqual(['Smith', 'BS9']);
  });

  it('skips non-string entries', () => {
    expect(parseRecentSearches(['Smith', 42, null, { x: 1 }, 'BS9'])).toEqual(['Smith', 'BS9']);
  });

  it('drops case-insensitive duplicates', () => {
    expect(parseRecentSearches(['Smith', 'smith', 'BS9'])).toEqual(['Smith', 'BS9']);
  });

  it('caps the list at MAX_RECENT_SEARCHES', () => {
    expect(parseRecentSearches(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toHaveLength(
      MAX_RECENT_SEARCHES,
    );
  });
});
