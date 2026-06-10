import { UnmappedStatusError } from '@/lib/migration/status-mapping';
import { transformJob } from '@/lib/migration/transform-job';
import {
  validateCustomerIdentifiers,
  validateSourceStatuses,
} from '@/lib/migration/validate-source';
import { describe, expect, it } from 'vitest';

describe('transformJob', () => {
  it('maps status fields and preserves the legacy reference', () => {
    expect(
      transformJob({
        status: 'Awaiting Deposit',
        reference: 'IMVE-123',
        createdDate: '2024-01-02',
      }),
    ).toEqual({
      stage: 'accepted',
      sub_status: 'awaiting_deposit',
      decline_reason: null,
      storage_status: null,
      legacy_reference: 'IMVE-123',
      created_at: '2024-01-02',
    });
  });

  it('throws on a blank status rather than guessing', () => {
    expect(() => transformJob({ status: '   ' })).toThrow(UnmappedStatusError);
  });

  it('throws on an unknown status', () => {
    expect(() => transformJob({ status: 'Mystery' })).toThrow(UnmappedStatusError);
  });
});

describe('validateSourceStatuses', () => {
  it('reports ok when every status is mappable', () => {
    const report = validateSourceStatuses([
      { status: 'New Enquiry' },
      { status: 'Quote Sent' },
      { status: 'Paid' },
    ]);
    expect(report.ok).toBe(true);
    expect(report.unmappedStatuses).toHaveLength(0);
    expect(report.totalRows).toBe(3);
  });

  it('collects every distinct unmapped status with row indices, not just the first', () => {
    const report = validateSourceStatuses([
      { status: 'New Enquiry' },
      { status: 'Weird One' },
      { status: 'Another Weird' },
      { status: 'Weird One' },
    ]);
    expect(report.ok).toBe(false);
    expect(report.unmappedStatuses).toEqual([
      { status: 'Another Weird', rowIndices: [2] },
      { status: 'Weird One', rowIndices: [1, 3] },
    ]);
  });

  it('flags blank-status rows separately', () => {
    const report = validateSourceStatuses([{ status: 'Paid' }, { status: '  ' }, { status: null }]);
    expect(report.ok).toBe(false);
    expect(report.blankStatusRows).toEqual([1, 2]);
  });
});

describe('validateCustomerIdentifiers', () => {
  it('passes when every row has an email or phone', () => {
    const report = validateCustomerIdentifiers([{ email: 'a@b.com' }, { phone: '0117 911 5000' }]);
    expect(report.ok).toBe(true);
  });

  it('flags rows with no usable identifier', () => {
    const report = validateCustomerIdentifiers([
      { email: 'a@b.com' },
      { email: '  ', phone: 'n/a' },
      {},
    ]);
    expect(report.ok).toBe(false);
    expect(report.rowsWithoutIdentifier).toEqual([1, 2]);
  });
});
