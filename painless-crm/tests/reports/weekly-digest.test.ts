import { kpiWindows } from '@/lib/reports/kpi';
import { type WeeklyDigestInput, buildWeeklyDigests } from '@/lib/reports/weekly-digest';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-06-08T00:00:00Z'); // a Monday
const WINDOWS = kpiWindows(NOW, 'week');
// current: 2026-06-01 → 2026-06-08 ; previous: 2026-05-25 → 2026-06-01
const THIS_WEEK = '2026-06-03T10:00:00Z';
const LAST_WEEK = '2026-05-28T10:00:00Z';

function input(o: Partial<WeeklyDigestInput>): WeeklyDigestInput {
  return {
    leadJobs: [],
    wonJobs: [],
    quotes: [],
    acceptances: [],
    managers: [{ company_id: 'co1', email: 'boss@co1.test' }],
    windows: WINDOWS,
    now: NOW,
    ...o,
  };
}

describe('buildWeeklyDigests', () => {
  it('produces one digest per company with recipients and current-week activity', () => {
    const digests = buildWeeklyDigests(
      input({
        leadJobs: [
          { company_id: 'co1', enquiry_at: THIS_WEEK },
          { company_id: 'co1', enquiry_at: THIS_WEEK },
        ],
        wonJobs: [{ company_id: 'co1', paid_at: THIS_WEEK, quote_total_pence: 1000_00 }],
      }),
    );
    expect(digests).toHaveLength(1);
    expect(digests[0]?.companyId).toBe('co1');
    expect(digests[0]?.recipients).toEqual(['boss@co1.test']);
    expect(digests[0]?.subject).toBe('Weekly summary — 1 won, 2 new leads');
    expect(digests[0]?.text).toContain('Leads: 2');
    expect(digests[0]?.text).toContain('Revenue won: £1,000');
  });

  it('shows a week-over-week delta when there was prior-week activity', () => {
    const digests = buildWeeklyDigests(
      input({
        leadJobs: [
          { company_id: 'co1', enquiry_at: THIS_WEEK },
          { company_id: 'co1', enquiry_at: THIS_WEEK },
          { company_id: 'co1', enquiry_at: LAST_WEEK }, // 1 last week → 2 vs 1 = +100%
        ],
      }),
    );
    expect(digests[0]?.text).toContain('Leads: 2 (↑ 100% vs last week)');
  });

  it('labels a metric with no prior-week baseline', () => {
    const digests = buildWeeklyDigests(
      input({ leadJobs: [{ company_id: 'co1', enquiry_at: THIS_WEEK }] }),
    );
    expect(digests[0]?.text).toContain('Leads: 1 (no prior week)');
  });

  it('skips companies with no current-week activity (no empty emails)', () => {
    const digests = buildWeeklyDigests(
      input({ leadJobs: [{ company_id: 'co1', enquiry_at: LAST_WEEK }] }),
    );
    expect(digests).toHaveLength(0);
  });

  it('drops a company that has activity but no manager recipients', () => {
    const digests = buildWeeklyDigests(
      input({
        managers: [],
        leadJobs: [{ company_id: 'co1', enquiry_at: THIS_WEEK }],
      }),
    );
    expect(digests).toHaveLength(0);
  });

  it('keeps each company separate', () => {
    const digests = buildWeeklyDigests(
      input({
        managers: [
          { company_id: 'co1', email: 'a@co1.test' },
          { company_id: 'co2', email: 'b@co2.test' },
        ],
        leadJobs: [
          { company_id: 'co1', enquiry_at: THIS_WEEK },
          { company_id: 'co2', enquiry_at: THIS_WEEK },
        ],
      }),
    );
    expect(digests).toHaveLength(2);
    expect(digests.map((d) => d.companyId).sort()).toEqual(['co1', 'co2']);
  });
});
