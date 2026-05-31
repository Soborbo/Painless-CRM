import {
  QUOTES_CSV_HEADER,
  quotesExportFilename,
  serializeQuotesToCsv,
} from '@/lib/exports/quotes-csv';
import type { QuoteListItem } from '@/lib/queries/quotes';
import { describe, expect, it } from 'vitest';

const BASE_CUSTOMER = {
  customer_type: 'individual',
  first_name: 'Mary',
  last_name: 'Smith',
  company_name: null as string | null,
  primary_email: 'mary@example.com',
};

const BASE_QUOTE: QuoteListItem = {
  id: 'q1',
  job_id: 'j1',
  job_number: 'J2026-00001',
  move_date: '2026-06-10T09:00:00.000Z',
  status: 'sent',
  total_pence: 145000,
  valid_until: '2026-06-01T00:00:00.000Z',
  sent_at: '2026-05-20T10:00:00.000Z',
  declined_at: null,
  withdrawn_at: null,
  revision_number: 1,
  open_count: 3,
  created_at: '2026-05-19T08:00:00.000Z',
  customer: BASE_CUSTOMER,
};

describe('serializeQuotesToCsv', () => {
  it('emits just the header for an empty input', () => {
    expect(serializeQuotesToCsv([])).toBe(`${QUOTES_CSV_HEADER.join(',')}\r\n`);
  });

  it('serialises a row with the linked job and customer', () => {
    const csv = serializeQuotesToCsv([BASE_QUOTE]);
    const [header, row] = csv.trimEnd().split('\r\n');
    expect(header).toBe(QUOTES_CSV_HEADER.join(','));
    expect(row).toBe(
      [
        'J2026-00001',
        'Mary Smith',
        'mary@example.com',
        'sent',
        '1',
        '145000',
        '2026-06-01T00:00:00.000Z',
        '2026-05-20T10:00:00.000Z',
        '',
        '',
        '3',
        '2026-05-19T08:00:00.000Z',
      ].join(','),
    );
  });

  it('blanks the customer when the join is missing', () => {
    const csv = serializeQuotesToCsv([{ ...BASE_QUOTE, customer: null }]);
    // job_number, then two empty customer cells before the status
    expect(csv.split('\r\n')[1]).toBe(
      'J2026-00001,,,sent,1,145000,2026-06-01T00:00:00.000Z,2026-05-20T10:00:00.000Z,,,3,2026-05-19T08:00:00.000Z',
    );
  });

  it('uses the company name for business customers', () => {
    const csv = serializeQuotesToCsv([
      {
        ...BASE_QUOTE,
        customer: { ...BASE_CUSTOMER, customer_type: 'business', company_name: 'Acme Ltd' },
      },
    ]);
    expect(csv.split('\r\n')[1]).toMatch(/^J2026-00001,Acme Ltd,/);
  });
});

describe('quotesExportFilename', () => {
  it('stamps the date in YYYY-MM-DD form', () => {
    expect(quotesExportFilename(new Date('2026-05-25T10:00:00Z'))).toBe('quotes-2026-05-25.csv');
    expect(quotesExportFilename(new Date('2026-01-03T23:59:59Z'))).toBe('quotes-2026-01-03.csv');
  });
});
