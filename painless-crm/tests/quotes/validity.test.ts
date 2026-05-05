import { classifyQuoteValidity } from '@/lib/queries/quotes';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-04T12:00:00Z');

describe('classifyQuoteValidity', () => {
  it('returns "fresh" when comfortably in the future', () => {
    expect(classifyQuoteValidity('2026-05-08T12:00:00Z', NOW)).toBe('fresh');
  });

  it('returns "expiring_soon" when within 24h', () => {
    expect(classifyQuoteValidity('2026-05-04T18:00:00Z', NOW)).toBe('expiring_soon');
    expect(classifyQuoteValidity('2026-05-05T11:00:00Z', NOW)).toBe('expiring_soon');
  });

  it('returns "expired" when valid_until is in the past', () => {
    expect(classifyQuoteValidity('2026-05-04T11:00:00Z', NOW)).toBe('expired');
    expect(classifyQuoteValidity('2026-05-04T12:00:00Z', NOW)).toBe('expired');
  });

  it('returns "expired" for malformed timestamps', () => {
    expect(classifyQuoteValidity('definitely-not-a-date', NOW)).toBe('expired');
  });
});
