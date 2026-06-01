import type { CapacityBand } from '@/lib/capacity/band';
import {
  type AvailabilityWeek,
  groupBandsByIsoWeek,
  isoWeekKey,
  isoWeekParts,
} from '@/lib/capacity/iso-week';
import {
  AVAILABILITY_KV_TTL_SECONDS,
  availabilityIndexKey,
  availabilityWeekKey,
  writeAvailabilityWith,
} from '@/lib/kv/availability';
import { describe, expect, it } from 'vitest';

describe('isoWeekKey', () => {
  it('places the Thursday-anchored first week correctly', () => {
    // 2026-01-01 is a Thursday → ISO week 2026-W01.
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2026-01-04')).toBe('2026-W01'); // Sunday, same ISO week
    expect(isoWeekKey('2026-01-05')).toBe('2026-W02'); // next Monday
  });

  it('assigns late-December days to the next year week-year when needed', () => {
    // 2025-12-29 (Mon) belongs to ISO week 2026-W01.
    expect(isoWeekParts('2025-12-29')).toEqual({ year: 2026, week: 1 });
    expect(isoWeekKey('2025-12-29')).toBe('2026-W01');
  });

  it('zero-pads the week number', () => {
    expect(isoWeekKey('2026-01-05')).toMatch(/^2026-W0\d$/);
  });
});

describe('groupBandsByIsoWeek', () => {
  const band = (b: CapacityBand) => b;
  it('buckets days by ISO week, preserving week order', () => {
    const weeks = groupBandsByIsoWeek([
      { date: '2026-01-04', band: band('green') }, // W01
      { date: '2026-01-05', band: band('yellow') }, // W02
      { date: '2026-01-06', band: band('red') }, // W02
    ]);
    expect(weeks.map((w) => w.week)).toEqual(['2026-W01', '2026-W02']);
    expect(weeks[0]?.days).toEqual({ '2026-01-04': 'green' });
    expect(weeks[1]?.days).toEqual({ '2026-01-05': 'yellow', '2026-01-06': 'red' });
  });

  it('returns an empty array for no days', () => {
    expect(groupBandsByIsoWeek([])).toEqual([]);
  });
});

function mockKV() {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    store,
    get: async (k: string) => store.get(k)?.value ?? null,
    put: async (k: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(k, { value, ttl: options?.expirationTtl });
    },
  };
}

describe('writeAvailabilityWith', () => {
  const COMPANY = '00000000-0000-0000-0000-000000000001';
  const NOW = '2026-01-01T00:00:00.000Z';
  const weeks: AvailabilityWeek[] = [
    { week: '2026-W01', days: { '2026-01-04': 'green' } },
    { week: '2026-W02', days: { '2026-01-05': 'red' } },
  ];

  it('degrades when no KV binding is present', async () => {
    const r = await writeAvailabilityWith(null, COMPANY, weeks, NOW);
    expect(r).toEqual({
      ok: false,
      reason: 'AVAILABILITY_KV binding unavailable',
      weeksWritten: 0,
    });
  });

  it('writes one key per week plus an index, with the 60-day TTL', async () => {
    const kv = mockKV();
    const r = await writeAvailabilityWith(kv, COMPANY, weeks, NOW);
    expect(r).toEqual({ ok: true, weeksWritten: 2 });

    const w1 = kv.store.get(availabilityWeekKey(COMPANY, '2026-W01'));
    expect(JSON.parse(w1?.value ?? '{}')).toEqual({
      week: '2026-W01',
      days: { '2026-01-04': 'green' },
      published_at: NOW,
    });
    expect(w1?.ttl).toBe(AVAILABILITY_KV_TTL_SECONDS);

    const index = kv.store.get(availabilityIndexKey(COMPANY));
    expect(JSON.parse(index?.value ?? '{}')).toEqual({
      weeks: ['2026-W01', '2026-W02'],
      published_at: NOW,
    });
  });

  it('keys are namespaced by company for multi-tenant safety', () => {
    expect(availabilityWeekKey(COMPANY, '2026-W01')).toBe(`availability:${COMPANY}:2026-W01`);
    expect(availabilityIndexKey(COMPANY)).toBe(`availability:${COMPANY}:index`);
  });
});
