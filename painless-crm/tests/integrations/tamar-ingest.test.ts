import { phoneMatchVariants } from '@/lib/integrations/tamar/ingest';
import { formatTamarDate } from '@/lib/integrations/tamar/poll';
import { describe, expect, it } from 'vitest';

describe('formatTamarDate', () => {
  it('formats UTC dates as dd/mm/yyyy', () => {
    expect(formatTamarDate(new Date('2026-06-16T09:30:00Z'))).toBe('16/06/2026');
    expect(formatTamarDate(new Date('2026-01-05T00:00:00Z'))).toBe('05/01/2026');
  });
});

describe('phoneMatchVariants', () => {
  it('expands a UK E.164 number to stored formats', () => {
    expect(phoneMatchVariants('+447700900123').sort()).toEqual(
      ['+447700900123', '07700900123', '447700900123'].sort(),
    );
  });

  it('returns just the number itself for non-UK / null', () => {
    expect(phoneMatchVariants('+15551234567')).toEqual(['+15551234567']);
    expect(phoneMatchVariants(null)).toEqual([]);
  });
});
