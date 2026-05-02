import { stripPII } from '@/lib/sentry/strip-pii';
import { describe, expect, it } from 'vitest';

describe('stripPII', () => {
  it('redacts known PII keys at the top level', () => {
    const input = { email: 'a@b.com', name: 'Jane', other: 'keep' };
    expect(stripPII(input)).toEqual({ email: '[REDACTED]', name: '[REDACTED]', other: 'keep' });
  });

  it('redacts nested PII inside arrays and objects', () => {
    const input = {
      customer: { full_name: 'Jane', phone: '555', city: 'Bristol' },
      ids: [1, 2],
      contacts: [{ email: 'a@b.com', note: 'safe' }],
    };
    const out = stripPII(input);
    expect(out.customer).toEqual({
      full_name: '[REDACTED]',
      phone: '[REDACTED]',
      city: '[REDACTED]',
    });
    expect(out.contacts[0]).toEqual({ email: '[REDACTED]', note: 'safe' });
    expect(out.ids).toEqual([1, 2]);
  });

  it('passes through primitives and nullish values', () => {
    expect(stripPII(null)).toBeNull();
    expect(stripPII(undefined)).toBeUndefined();
    expect(stripPII(42)).toBe(42);
    expect(stripPII('hello')).toBe('hello');
  });

  it('matches keys case-insensitively', () => {
    const input = { Email: 'a@b.com', PHONE: '1', Address: 'x' };
    expect(stripPII(input)).toEqual({
      Email: '[REDACTED]',
      PHONE: '[REDACTED]',
      Address: '[REDACTED]',
    });
  });
});
