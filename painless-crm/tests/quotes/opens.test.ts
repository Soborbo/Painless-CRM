import { decideQuoteOpen } from '@/lib/quotes/opens';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-04T12:00:00Z');

describe('decideQuoteOpen', () => {
  it('records the very first open when first_opened_at is null', () => {
    const decision = decideQuoteOpen(
      { status: 'sent', first_opened_at: null, last_opened_at: null },
      NOW,
    );
    expect(decision).toEqual({ record: true, reason: 'first_open' });
  });

  it('records subsequent opens once the throttle window has passed', () => {
    const decision = decideQuoteOpen(
      {
        status: 'sent',
        first_opened_at: '2026-05-04T11:00:00Z',
        last_opened_at: '2026-05-04T11:55:00Z',
      },
      NOW,
    );
    expect(decision).toEqual({ record: true, reason: 'subsequent_open' });
  });

  it('throttles refreshes within 60 seconds', () => {
    const decision = decideQuoteOpen(
      {
        status: 'sent',
        first_opened_at: '2026-05-04T11:00:00Z',
        last_opened_at: '2026-05-04T11:59:30Z',
      },
      NOW,
    );
    expect(decision).toEqual({ record: false, reason: 'throttled' });
  });

  it('falls back to first_opened_at when last_opened_at is null', () => {
    const decision = decideQuoteOpen(
      { status: 'sent', first_opened_at: '2026-05-04T11:59:30Z', last_opened_at: null },
      NOW,
    );
    expect(decision.record).toBe(false);
    expect(decision.reason).toBe('throttled');
  });

  it('does not churn terminal-status quotes', () => {
    for (const status of ['accepted', 'declined', 'expired'] as const) {
      const decision = decideQuoteOpen(
        { status, first_opened_at: null, last_opened_at: null },
        NOW,
      );
      expect(decision).toEqual({ record: false, reason: 'terminal_status' });
    }
  });

  it('records a draft open (preview by sales rep before send)', () => {
    const decision = decideQuoteOpen(
      { status: 'draft', first_opened_at: null, last_opened_at: null },
      NOW,
    );
    expect(decision).toEqual({ record: true, reason: 'first_open' });
  });

  it('handles missing status defensively', () => {
    expect(
      decideQuoteOpen({ status: null, first_opened_at: null, last_opened_at: null }, NOW),
    ).toEqual({ record: false, reason: 'no_status' });
  });

  it('rejects malformed last_opened_at strings', () => {
    expect(
      decideQuoteOpen(
        { status: 'sent', first_opened_at: 'not-a-date', last_opened_at: 'not-a-date' },
        NOW,
      ),
    ).toEqual({ record: false, reason: 'invalid_timestamp' });
  });
});
