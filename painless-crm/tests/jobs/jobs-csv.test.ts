import {
  type ExportableJob,
  JOBS_CSV_HEADER,
  csvField,
  exportFilename,
  serializeJobsToCsv,
} from '@/lib/exports/jobs-csv';
import { describe, expect, it } from 'vitest';

const BASE_JOB: ExportableJob = {
  job_number: 'J2026-00001',
  stage: 'quoted',
  acquisition_source: 'google_ads',
  move_date: '2026-06-15T09:00:00.000Z',
  enquiry_at: '2026-05-01T08:00:00.000Z',
  accepted_at: null,
  quote_total_pence: 84_000,
  first_response_due_at: '2026-05-01T08:10:00.000Z',
  first_response_at: '2026-05-01T08:07:00.000Z',
  notes: null,
  created_at: '2026-05-01T08:00:00.000Z',
  customer: {
    customer_type: 'individual',
    first_name: 'Mary',
    last_name: 'Smith',
    company_name: null,
    primary_email: 'mary@example.com',
  },
  assigned_to: { full_name: 'Jay Doe' },
  tags: ['vip', 'repeat'],
};

describe('csvField', () => {
  it('returns empty for null/undefined', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('passes simple strings through unchanged', () => {
    expect(csvField('hello')).toBe('hello');
    expect(csvField('with spaces')).toBe('with spaces');
  });

  it('stringifies numbers', () => {
    expect(csvField(0)).toBe('0');
    expect(csvField(84_000)).toBe('84000');
  });

  it('quotes and escapes values that contain commas, quotes, or newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('serializeJobsToCsv', () => {
  it('emits just the header for an empty input', () => {
    const csv = serializeJobsToCsv([]);
    expect(csv).toBe(`${JOBS_CSV_HEADER.join(',')}\r\n`);
  });

  it('serialises a row with all the canonical columns', () => {
    const csv = serializeJobsToCsv([BASE_JOB]);
    const [header, row] = csv.trimEnd().split('\r\n');
    expect(header).toBe(JOBS_CSV_HEADER.join(','));
    expect(row).toBe(
      [
        'J2026-00001',
        'quoted',
        'Mary Smith',
        'mary@example.com',
        'Jay Doe',
        'google_ads',
        'vip; repeat',
        '2026-06-15T09:00:00.000Z',
        '2026-05-01T08:00:00.000Z',
        '',
        '2026-05-01T08:10:00.000Z',
        '2026-05-01T08:07:00.000Z',
        '84000',
        '',
        '2026-05-01T08:00:00.000Z',
      ].join(','),
    );
  });

  it('escapes notes that contain commas and newlines', () => {
    const csv = serializeJobsToCsv([{ ...BASE_JOB, notes: 'Has a comma, and a\nnewline' }]);
    expect(csv).toContain('"Has a comma, and a\nnewline"');
  });

  it('falls back to email when both name fields are missing', () => {
    const csv = serializeJobsToCsv([
      {
        ...BASE_JOB,
        customer: {
          customer_type: 'individual',
          first_name: null,
          last_name: null,
          company_name: null,
          primary_email: 'fallback@example.com',
        },
      },
    ]);
    expect(csv).toContain(',fallback@example.com,fallback@example.com,');
  });

  it('renders empty strings for a job with no customer or assignee', () => {
    const csv = serializeJobsToCsv([{ ...BASE_JOB, customer: null, assigned_to: null, tags: [] }]);
    expect(csv.split('\r\n')[1]).toContain(',,,Jay Doe'.replace('Jay Doe', ''));
  });
});

describe('exportFilename', () => {
  it('stamps the date in YYYY-MM-DD form', () => {
    expect(exportFilename(new Date('2026-05-25T10:00:00Z'))).toBe('jobs-2026-05-25.csv');
    expect(exportFilename(new Date('2026-01-03T23:59:59Z'))).toBe('jobs-2026-01-03.csv');
  });
});
