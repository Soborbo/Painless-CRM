import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIGH_VALUE_THRESHOLD_PENCE,
  resolveThreshold,
  type ScanJob,
  selectHighValueUncontacted,
} from '@/lib/notifications/high-value-leads';

describe('resolveThreshold', () => {
  it('defaults to £800 when unset or malformed', () => {
    expect(resolveThreshold(null)).toBe(DEFAULT_HIGH_VALUE_THRESHOLD_PENCE);
    expect(resolveThreshold({})).toBe(80000);
    expect(resolveThreshold({ high_value_lead_threshold_pence: 'x' })).toBe(80000);
    expect(resolveThreshold({ high_value_lead_threshold_pence: -5 })).toBe(80000);
  });
  it('honours a configured company threshold', () => {
    expect(resolveThreshold({ high_value_lead_threshold_pence: 150000 })).toBe(150000);
  });
});

describe('selectHighValueUncontacted', () => {
  const jobs: ScanJob[] = [
    { id: 'j1', company_id: 'co', job_number: 'J1', quote_total_pence: 120000, customerName: 'Alice' }, // > £800, qualifies
    { id: 'j2', company_id: 'co', job_number: 'J2', quote_total_pence: 50000, customerName: 'Bob' }, // < £800
    { id: 'j3', company_id: 'co', job_number: 'J3', quote_total_pence: 90000, customerName: 'Cara' }, // callback requested
    { id: 'j4', company_id: 'co', job_number: 'J4', quote_total_pence: 90000, customerName: 'Dan' }, // already notified
  ];
  const thresholds = new Map([['co', 80000]]);

  it('selects only high-value, no-callback, not-yet-notified leads', () => {
    const out = selectHighValueUncontacted(jobs, thresholds, new Set(['j3']), new Set(['j4']));
    expect(out.map((l) => l.jobId)).toEqual(['j1']);
    expect(out[0]).toMatchObject({ customerName: 'Alice', valuePence: 120000 });
  });

  it('uses the exclusive boundary (exactly the threshold does not qualify)', () => {
    const atThreshold: ScanJob[] = [
      { id: 'e', company_id: 'co', job_number: 'E', quote_total_pence: 80000, customerName: 'Eve' },
    ];
    expect(selectHighValueUncontacted(atThreshold, thresholds, new Set(), new Set())).toEqual([]);
  });

  it('applies each company threshold independently', () => {
    const mixed: ScanJob[] = [
      { id: 'a', company_id: 'co', job_number: 'A', quote_total_pence: 90000, customerName: 'A' },
      { id: 'b', company_id: 'big', job_number: 'B', quote_total_pence: 90000, customerName: 'B' },
    ];
    const map = new Map([
      ['co', 80000],
      ['big', 100000],
    ]);
    const out = selectHighValueUncontacted(mixed, map, new Set(), new Set());
    expect(out.map((l) => l.jobId)).toEqual(['a']);
  });
});
