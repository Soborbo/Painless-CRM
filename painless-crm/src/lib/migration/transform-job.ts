// iMVE job row → painless-crm job insert shape (status portion). Pure transform.
// The CRITICAL stage mapping lives in status-mapping.ts (MIGRATION_MAPPING.md §3).

import type { JobStage } from '@/lib/jobs/state-machine';
import { normalizeText } from './normalize';
import { type StorageStatus, UnmappedStatusError, mapStatus } from './status-mapping';

export type RawImveJob = {
  status?: string | null;
  reference?: string | null;
  createdDate?: string | null;
};

export type JobTransformResult = {
  stage: JobStage;
  sub_status: string | null;
  decline_reason: string | null;
  /** When non-null, the loader also creates a storage_rentals row with this status. */
  storage_status: StorageStatus | null;
  legacy_reference: string | null;
  created_at: string | null;
};

/** Transform one iMVE job row. Throws UnmappedStatusError if the status is unknown —
 *  the import must halt rather than guess a stage. Use validateSourceStatuses first to
 *  surface every unmapped status up front. */
export function transformJob(raw: RawImveJob): JobTransformResult {
  const status = (raw.status ?? '').trim();
  if (status === '') {
    throw new UnmappedStatusError('(empty status)');
  }
  const mapped = mapStatus(status);
  return {
    stage: mapped.stage,
    sub_status: mapped.sub_status,
    decline_reason: mapped.decline_reason,
    storage_status: mapped.storage_status,
    legacy_reference: normalizeText(raw.reference),
    created_at: normalizeText(raw.createdDate),
  };
}
