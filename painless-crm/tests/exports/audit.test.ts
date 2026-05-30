import { auditContextFromHeaders, buildExportAuditRow } from '@/lib/exports/audit';
import { describe, expect, it } from 'vitest';

describe('buildExportAuditRow', () => {
  it('maps the core fields and defaults the format to csv', () => {
    const row = buildExportAuditRow({
      companyId: 'company-1',
      userId: 'user-1',
      resource: 'customers',
      filters: { q: 'smith', type: 'business' },
      rowCount: 42,
    });
    expect(row).toEqual({
      company_id: 'company-1',
      exported_by_id: 'user-1',
      resource: 'customers',
      format: 'csv',
      filters: { q: 'smith', type: 'business' },
      row_count: 42,
    });
  });

  it('drops null, undefined and empty-string filter values', () => {
    const row = buildExportAuditRow({
      companyId: 'company-1',
      userId: 'user-1',
      resource: 'jobs',
      filters: { q: undefined, stage: null, assigned_to_id: '', keep: 'yes' },
      rowCount: 0,
    });
    expect(row.filters).toEqual({ keep: 'yes' });
  });

  it('keeps falsy-but-meaningful values like 0 and false', () => {
    const row = buildExportAuditRow({
      companyId: 'company-1',
      userId: 'user-1',
      resource: 'profit',
      filters: { count: 0, flag: false, range: 'month' },
      rowCount: 7,
    });
    expect(row.filters).toEqual({ count: 0, flag: false, range: 'month' });
  });

  it('honours an explicit xlsx format', () => {
    const row = buildExportAuditRow({
      companyId: 'c',
      userId: 'u',
      resource: 'jobs',
      filters: {},
      rowCount: 1,
      format: 'xlsx',
    });
    expect(row.format).toBe('xlsx');
  });

  it('attaches IP and a truncated user-agent when present', () => {
    const longUa = 'x'.repeat(600);
    const row = buildExportAuditRow({
      companyId: 'c',
      userId: 'u',
      resource: 'jobs',
      filters: {},
      rowCount: 1,
      ipAddress: '203.0.113.7',
      userAgent: longUa,
    });
    expect(row.ip_address).toBe('203.0.113.7');
    expect((row.user_agent as string).length).toBe(500);
  });

  it('omits IP / user-agent keys entirely when absent so inet never sees an empty string', () => {
    const row = buildExportAuditRow({
      companyId: 'c',
      userId: 'u',
      resource: 'jobs',
      filters: {},
      rowCount: 1,
      ipAddress: null,
      userAgent: null,
    });
    expect('ip_address' in row).toBe(false);
    expect('user_agent' in row).toBe(false);
  });
});

describe('auditContextFromHeaders', () => {
  it('prefers cf-connecting-ip and reads the user-agent', () => {
    const headers = new Headers({
      'cf-connecting-ip': '198.51.100.4',
      'x-forwarded-for': '10.0.0.1, 70.0.0.1',
      'user-agent': 'Mozilla/5.0 test',
    });
    expect(auditContextFromHeaders(headers)).toEqual({
      ipAddress: '198.51.100.4',
      userAgent: 'Mozilla/5.0 test',
    });
  });

  it('falls back to the first x-forwarded-for hop and tolerates a missing UA', () => {
    const headers = new Headers({ 'x-forwarded-for': '70.0.0.1, 10.0.0.1' });
    expect(auditContextFromHeaders(headers)).toEqual({
      ipAddress: '70.0.0.1',
      userAgent: null,
    });
  });
});
