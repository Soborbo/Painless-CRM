import {
  CUSTOMERS_CSV_HEADER,
  type ExportableCustomer,
  customersExportFilename,
  serializeCustomersToCsv,
} from '@/lib/exports/customers-csv';
import { describe, expect, it } from 'vitest';

const BASE_CUSTOMER: ExportableCustomer = {
  customer_type: 'individual',
  first_name: 'Mary',
  last_name: 'Smith',
  company_name: null,
  primary_email: 'mary@example.com',
  primary_phone: '07700 900123',
  acquisition_source: 'google_ads',
  created_at: '2026-05-01T08:00:00.000Z',
};

describe('serializeCustomersToCsv', () => {
  it('emits just the header for an empty input', () => {
    const csv = serializeCustomersToCsv([]);
    expect(csv).toBe(`${CUSTOMERS_CSV_HEADER.join(',')}\r\n`);
  });

  it('serialises an individual row with the display name first', () => {
    const csv = serializeCustomersToCsv([BASE_CUSTOMER]);
    const [header, row] = csv.trimEnd().split('\r\n');
    expect(header).toBe(CUSTOMERS_CSV_HEADER.join(','));
    expect(row).toBe(
      [
        'Mary Smith',
        'individual',
        'Mary',
        'Smith',
        '',
        'mary@example.com',
        '07700 900123',
        'google_ads',
        '2026-05-01T08:00:00.000Z',
      ].join(','),
    );
  });

  it('uses the company name as the display name for business customers', () => {
    const csv = serializeCustomersToCsv([
      {
        ...BASE_CUSTOMER,
        customer_type: 'business',
        company_name: 'Acme Ltd',
      },
    ]);
    expect(csv.split('\r\n')[1]).toMatch(/^Acme Ltd,business,/);
  });

  it('falls back to email when both name fields are missing', () => {
    const csv = serializeCustomersToCsv([
      {
        ...BASE_CUSTOMER,
        first_name: null,
        last_name: null,
        primary_email: 'fallback@example.com',
      },
    ]);
    expect(csv.split('\r\n')[1]).toMatch(/^fallback@example\.com,individual,/);
  });

  it('escapes values that contain commas', () => {
    const csv = serializeCustomersToCsv([{ ...BASE_CUSTOMER, company_name: 'Smith, Jones & Co' }]);
    expect(csv).toContain('"Smith, Jones & Co"');
  });
});

describe('customersExportFilename', () => {
  it('stamps the date in YYYY-MM-DD form', () => {
    expect(customersExportFilename(new Date('2026-05-25T10:00:00Z'))).toBe(
      'customers-2026-05-25.csv',
    );
    expect(customersExportFilename(new Date('2026-01-03T23:59:59Z'))).toBe(
      'customers-2026-01-03.csv',
    );
  });
});
