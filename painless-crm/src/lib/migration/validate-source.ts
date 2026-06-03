// Pre-import source validation. Scans the whole iMVE export and reports every problem
// at once (unmapped statuses, missing identifiers) rather than failing on the first row.
// Run before any transform/load. Mirrors MIGRATION_MAPPING.md §8 "validate-source".

import { isMappableStatus } from './status-mapping';
import { customerDedupKey } from './normalize';

export type SourceStatusReport = {
  ok: boolean;
  /** Distinct unmapped statuses (verbatim), each with the row indices where they appear. */
  unmappedStatuses: { status: string; rowIndices: number[] }[];
  /** Row indices whose status cell was blank/whitespace. */
  blankStatusRows: number[];
  totalRows: number;
};

/** Validate that every job row's status is mappable. Returns a report; ok === true only
 *  when there are no unmapped or blank statuses. Does not throw — the caller decides. */
export function validateSourceStatuses(
  rows: readonly { status?: string | null }[],
): SourceStatusReport {
  const unmapped = new Map<string, number[]>();
  const blankStatusRows: number[] = [];

  rows.forEach((row, i) => {
    const status = (row.status ?? '').trim();
    if (status === '') {
      blankStatusRows.push(i);
      return;
    }
    if (!isMappableStatus(status)) {
      const list = unmapped.get(status) ?? [];
      list.push(i);
      unmapped.set(status, list);
    }
  });

  const unmappedStatuses = [...unmapped.entries()]
    .map(([status, rowIndices]) => ({ status, rowIndices }))
    .sort((a, b) => a.status.localeCompare(b.status));

  return {
    ok: unmappedStatuses.length === 0 && blankStatusRows.length === 0,
    unmappedStatuses,
    blankStatusRows,
    totalRows: rows.length,
  };
}

export type CustomerIdentityReport = {
  ok: boolean;
  /** Row indices with neither a usable email nor phone — cannot be auto-deduped. */
  rowsWithoutIdentifier: number[];
  totalRows: number;
};

/** Flag iMVE customer rows that carry no email and no phone, so they can be reviewed
 *  before import (the loader can't deduplicate them). MIGRATION_MAPPING.md §2. */
export function validateCustomerIdentifiers(
  rows: readonly { email?: string | null; phone?: string | null }[],
): CustomerIdentityReport {
  const rowsWithoutIdentifier: number[] = [];
  rows.forEach((row, i) => {
    if (customerDedupKey(row) === null) rowsWithoutIdentifier.push(i);
  });
  return {
    ok: rowsWithoutIdentifier.length === 0,
    rowsWithoutIdentifier,
    totalRows: rows.length,
  };
}
