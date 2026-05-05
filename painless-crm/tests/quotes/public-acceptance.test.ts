import type { PublicQuote } from '@/lib/queries/public-quote';
import { classifyAcceptable, pickClientIp } from '@/lib/quotes/public-acceptance';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-04T12:00:00Z');

function quote(overrides: Partial<PublicQuote> = {}): PublicQuote {
  return {
    id: 'q1',
    company_id: 'c1',
    job_id: 'j1',
    status: 'sent',
    total_pence: 100000,
    valid_until: '2026-05-08T12:00:00Z',
    size_code: '3-bed',
    distance_miles: 12,
    complications: null,
    breakdown: null,
    customer: { id: 'cu1', display_name: 'Smith' },
    job: { job_number: 'J2026-00001', move_date: '2026-05-15T09:00:00Z' },
    company: { name: 'Painless' },
    pricing_version_label: 'v1',
    ...overrides,
  };
}

describe('classifyAcceptable', () => {
  it('accepts a fresh sent quote', () => {
    expect(classifyAcceptable(quote(), NOW)).toEqual({ ok: true });
  });

  it('blocks already-accepted quotes', () => {
    expect(classifyAcceptable(quote({ status: 'accepted' }), NOW)).toEqual({
      ok: false,
      reason: 'already_accepted',
    });
  });

  it('blocks declined quotes', () => {
    expect(classifyAcceptable(quote({ status: 'declined' }), NOW)).toEqual({
      ok: false,
      reason: 'declined',
    });
  });

  it('blocks quotes whose validity passed', () => {
    expect(classifyAcceptable(quote({ valid_until: '2026-05-04T11:00:00Z' }), NOW)).toEqual({
      ok: false,
      reason: 'expired_validity',
    });
  });

  it('blocks quotes already flagged expired', () => {
    expect(classifyAcceptable(quote({ status: 'expired' }), NOW)).toEqual({
      ok: false,
      reason: 'expired_status',
    });
  });
});

describe('pickClientIp', () => {
  it('prefers Cloudflare header', () => {
    const h = new Headers({
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.1',
    });
    expect(pickClientIp(h)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip then x-forwarded-for', () => {
    expect(pickClientIp(new Headers({ 'x-real-ip': '198.51.100.5' }))).toBe('198.51.100.5');
    expect(pickClientIp(new Headers({ 'x-forwarded-for': '203.0.113.10, 10.0.0.1' }))).toBe(
      '203.0.113.10',
    );
  });

  it('returns null when no IP headers are present', () => {
    expect(pickClientIp(new Headers())).toBeNull();
  });
});
