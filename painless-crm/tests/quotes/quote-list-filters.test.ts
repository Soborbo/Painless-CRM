import { QUOTE_PAGE_SIZE, QuoteListFiltersSchema } from '@/lib/schemas/quote';
import { describe, expect, it } from 'vitest';

describe('QuoteListFiltersSchema', () => {
  it('defaults page to 1 and leaves optional filters undefined', () => {
    const out = QuoteListFiltersSchema.parse({});
    expect(out).toEqual({ page: 1 });
    expect(out.q).toBeUndefined();
    expect(out.status).toBeUndefined();
  });

  it('trims the search term', () => {
    expect(QuoteListFiltersSchema.parse({ q: '  J2026-1  ' }).q).toBe('J2026-1');
  });

  it('coerces the page from a string', () => {
    expect(QuoteListFiltersSchema.parse({ page: '3' }).page).toBe(3);
  });

  it('accepts the known statuses and rejects unknown ones', () => {
    expect(QuoteListFiltersSchema.parse({ status: 'accepted' }).status).toBe('accepted');
    expect(QuoteListFiltersSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  it('rejects an over-long search term', () => {
    expect(QuoteListFiltersSchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
  });

  it('keeps the documented page size', () => {
    expect(QUOTE_PAGE_SIZE).toBe(50);
  });

  it('accepts a valid created-date range', () => {
    const parsed = QuoteListFiltersSchema.parse({
      created_from: '2026-04-01',
      created_to: '2026-04-30',
    });
    expect(parsed.created_from).toBe('2026-04-01');
    expect(parsed.created_to).toBe('2026-04-30');
  });

  it('treats empty created-date strings as unset', () => {
    const parsed = QuoteListFiltersSchema.parse({ created_from: '', created_to: '' });
    expect(parsed.created_from).toBeUndefined();
    expect(parsed.created_to).toBeUndefined();
  });

  it('rejects a non-ISO created-date', () => {
    expect(QuoteListFiltersSchema.safeParse({ created_from: '30-04-2026' }).success).toBe(false);
  });

  it('rejects an inverted created-date range', () => {
    const parsed = QuoteListFiltersSchema.safeParse({
      created_from: '2026-04-30',
      created_to: '2026-04-01',
    });
    expect(parsed.success).toBe(false);
  });
});
