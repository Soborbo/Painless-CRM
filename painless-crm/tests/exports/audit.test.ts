import { buildExportAuditRow } from '@/lib/exports/audit';
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
});
