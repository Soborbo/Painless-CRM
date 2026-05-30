import {
  PROFIT_CSV_HEADER,
  profitExportFilename,
  serializeProfitToCsv,
} from '@/lib/exports/profit-csv';
import type { ProfitDashboardJob } from '@/lib/jobs/profit-dashboard';
import { describe, expect, it } from 'vitest';

const BASE_JOB: ProfitDashboardJob = {
  id: 'job-1',
  job_number: 'J2026-00001',
  stage: 'paid',
  completed_at: '2026-05-10T16:00:00.000Z',
  acquisition_source: 'google_ads',
  profit_review_status: 'reviewed',
  actual_crew_cost_pence: 20_000,
  actual_van_cost_pence: 8_000,
  passthrough_costs_pence: 2_000,
  revenuePence: 84_000,
  customer: {
    customer_type: 'individual',
    first_name: 'Mary',
    last_name: 'Smith',
    company_name: null,
    primary_email: 'mary@example.com',
  },
  assigned_to: { id: 'u1', full_name: 'Jay Doe' },
};

describe('serializeProfitToCsv', () => {
  it('emits just the header for an empty input', () => {
    expect(serializeProfitToCsv([])).toBe(`${PROFIT_CSV_HEADER.join(',')}\r\n`);
  });

  it('computes cost, profit and margin per row in pence', () => {
    const csv = serializeProfitToCsv([BASE_JOB]);
    const [header, row] = csv.trimEnd().split('\r\n');
    expect(header).toBe(PROFIT_CSV_HEADER.join(','));
    // cost = 20000 + 8000 + 2000 = 30000; profit = 84000 - 30000 = 54000;
    // margin = 54000 / 84000 * 100 = 64.3 (1dp)
    expect(row).toBe(
      [
        'J2026-00001',
        'Mary Smith',
        '2026-05-10T16:00:00.000Z',
        'google_ads',
        'reviewed',
        '84000',
        '30000',
        '54000',
        '64.3',
      ].join(','),
    );
  });

  it('leaves the margin blank when revenue is zero', () => {
    const csv = serializeProfitToCsv([{ ...BASE_JOB, revenuePence: 0 }]);
    const row = csv.trimEnd().split('\r\n')[1];
    // revenue 0 → cost 30000 → profit -30000 → margin null → trailing empty cell
    expect(row).toBe(
      [
        'J2026-00001',
        'Mary Smith',
        '2026-05-10T16:00:00.000Z',
        'google_ads',
        'reviewed',
        '0',
        '30000',
        '-30000',
        '',
      ].join(','),
    );
  });

  it('treats null cost fields as zero', () => {
    const csv = serializeProfitToCsv([
      {
        ...BASE_JOB,
        actual_crew_cost_pence: null,
        actual_van_cost_pence: null,
        passthrough_costs_pence: null,
      },
    ]);
    const row = csv.trimEnd().split('\r\n')[1];
    // cost 0 → profit = revenue 84000 → margin 100.0
    expect(row).toContain(',84000,0,84000,100.0');
  });
});

describe('profitExportFilename', () => {
  it('stamps the date in YYYY-MM-DD form', () => {
    expect(profitExportFilename(new Date('2026-05-25T10:00:00Z'))).toBe('profit-2026-05-25.csv');
    expect(profitExportFilename(new Date('2026-01-03T23:59:59Z'))).toBe('profit-2026-01-03.csv');
  });
});
