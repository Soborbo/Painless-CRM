import { ContactDetailsSchema, normaliseSource, splitName } from '@/lib/jobs/intake';
import { describe, expect, it } from 'vitest';

describe('splitName', () => {
  it('returns nulls for an empty string', () => {
    expect(splitName('')).toEqual({ first: null, last: null });
  });

  it('returns first only when single word', () => {
    expect(splitName('Cher')).toEqual({ first: 'Cher', last: null });
  });

  it('joins all trailing words into last', () => {
    expect(splitName('Mary Jane Watson')).toEqual({ first: 'Mary', last: 'Jane Watson' });
  });

  it('collapses multiple internal whitespace', () => {
    expect(splitName('  John   Smith  ')).toEqual({ first: 'John', last: 'Smith' });
  });
});

describe('normaliseSource', () => {
  it('returns the source verbatim when it is a known acquisition source', () => {
    expect(normaliseSource('google_ads')).toBe('google_ads');
    expect(normaliseSource('referral')).toBe('referral');
  });

  it('falls back to "website" for unknown sources', () => {
    expect(normaliseSource('totally_made_up')).toBe('website');
    expect(normaliseSource('')).toBe('website');
  });
});

describe('ContactDetailsSchema', () => {
  it('accepts a UK-style phone with spaces', () => {
    const parsed = ContactDetailsSchema.parse({
      full_name: 'Sample',
      email: 's@example.com',
      phone: '07700 900 123',
    });
    expect(parsed.phone).toBe('07700 900 123');
  });

  it('rejects an empty full_name', () => {
    expect(() =>
      ContactDetailsSchema.parse({
        full_name: '',
        email: 's@example.com',
        phone: '07700 900123',
      }),
    ).toThrow();
  });
});
