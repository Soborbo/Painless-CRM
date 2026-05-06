import { parseDeclineForm } from '@/lib/quotes/decline-form';
import { describe, expect, it } from 'vitest';

const validToken = 'abcdef12345';

describe('parseDeclineForm', () => {
  it('accepts a valid token and trims a non-empty reason', () => {
    const out = parseDeclineForm({ token: validToken, reason: '   wrong dates  ' });
    expect(out).toEqual({ ok: true, data: { token: validToken, reason: 'wrong dates' } });
  });

  it('treats an empty string reason as no reason', () => {
    const out = parseDeclineForm({ token: validToken, reason: '' });
    expect(out).toEqual({ ok: true, data: { token: validToken, reason: null } });
  });

  it('treats a whitespace-only reason as no reason', () => {
    const out = parseDeclineForm({ token: validToken, reason: '   ' });
    expect(out).toEqual({ ok: true, data: { token: validToken, reason: null } });
  });

  it('treats a missing reason field as no reason', () => {
    const out = parseDeclineForm({ token: validToken, reason: undefined });
    expect(out).toEqual({ ok: true, data: { token: validToken, reason: null } });
  });

  it('rejects a token that is too short', () => {
    expect(parseDeclineForm({ token: 'abc', reason: '' })).toEqual({
      ok: false,
      reason: 'invalid_token',
    });
  });

  it('rejects a non-string token', () => {
    expect(parseDeclineForm({ token: 42, reason: '' })).toEqual({
      ok: false,
      reason: 'invalid_token',
    });
  });

  it('rejects reasons longer than 500 chars with a distinct code', () => {
    const out = parseDeclineForm({ token: validToken, reason: 'x'.repeat(501) });
    expect(out).toEqual({ ok: false, reason: 'reason_too_long' });
  });
});
