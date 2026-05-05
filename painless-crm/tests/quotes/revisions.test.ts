import { shouldSupersede } from '@/lib/quotes/revisions';
import { describe, expect, it } from 'vitest';

describe('shouldSupersede', () => {
  it('flips draft predecessors', () => {
    expect(shouldSupersede('draft')).toBe(true);
  });

  it('flips sent predecessors', () => {
    expect(shouldSupersede('sent')).toBe(true);
  });

  it('leaves accepted predecessors alone (contractual record)', () => {
    expect(shouldSupersede('accepted')).toBe(false);
  });

  it('leaves declined predecessors alone', () => {
    expect(shouldSupersede('declined')).toBe(false);
  });

  it('treats already-expired predecessors as no-op', () => {
    expect(shouldSupersede('expired')).toBe(false);
  });

  it('handles missing status defensively', () => {
    expect(shouldSupersede(null)).toBe(false);
    expect(shouldSupersede(undefined)).toBe(false);
  });
});
