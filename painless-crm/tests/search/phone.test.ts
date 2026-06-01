import { MIN_PHONE_DIGITS, isPhoneLikeQuery, normalizePhoneDigits } from '@/lib/search/phone';
import { describe, expect, it } from 'vitest';

describe('normalizePhoneDigits', () => {
  it('strips spaces, dashes, parens and a leading plus', () => {
    expect(normalizePhoneDigits('07700 900123')).toBe('07700900123');
    expect(normalizePhoneDigits('(0117) 496-0123')).toBe('01174960123');
    expect(normalizePhoneDigits('+44 7700 900123')).toBe('447700900123');
  });

  it('returns an empty string when there are no digits', () => {
    expect(normalizePhoneDigits('Smith')).toBe('');
  });
});

describe('isPhoneLikeQuery', () => {
  it('accepts formatted phone numbers', () => {
    expect(isPhoneLikeQuery('07700 900123')).toBe(true);
    expect(isPhoneLikeQuery('+44 (0)117 496 0123')).toBe(true);
    expect(isPhoneLikeQuery('900123')).toBe(true);
  });

  it('rejects anything containing letters', () => {
    expect(isPhoneLikeQuery('BS9 4PN')).toBe(false);
    expect(isPhoneLikeQuery('Smith')).toBe(false);
    expect(isPhoneLikeQuery('07700x')).toBe(false);
  });

  it('rejects queries with too few digits', () => {
    expect(isPhoneLikeQuery('12')).toBe(false);
    expect(isPhoneLikeQuery('1'.repeat(MIN_PHONE_DIGITS - 1))).toBe(false);
    expect(isPhoneLikeQuery('1'.repeat(MIN_PHONE_DIGITS))).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isPhoneLikeQuery('  07700900123  ')).toBe(true);
  });
});
