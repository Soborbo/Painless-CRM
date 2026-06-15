import type { JobAddressSummary } from '@/lib/jobs/card-format';
import { createClient } from '@/lib/supabase/server';

export type JobAddressMap = Record<string, JobAddressSummary[]>;

type RawRow = {
  job_id: string;
  role: string;
  sequence: number | null;
  property_type: string | null;
  floor: number | null;
  has_lift: boolean | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
  } | null;
};

/** Bulk-loads from/to/via addresses for a page of jobs, keyed by job id. */
export async function listAddressesForJobs(jobIds: string[]): Promise<JobAddressMap> {
  if (jobIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_addresses')
    .select(
      'job_id, role, sequence, property_type, floor, has_lift, address:addresses (line1, line2, city, postcode)',
    )
    .in('job_id', jobIds)
    .is('deleted_at', null)
    .order('sequence', { ascending: true });

  const map: JobAddressMap = {};
  for (const raw of (data ?? []) as unknown as RawRow[]) {
    if (!raw.address) continue;
    if (raw.role !== 'from' && raw.role !== 'to' && raw.role !== 'via') continue;
    const entry: JobAddressSummary = {
      job_id: raw.job_id,
      role: raw.role,
      line1: raw.address.line1,
      line2: raw.address.line2,
      city: raw.address.city,
      postcode: raw.address.postcode,
      property_type: raw.property_type,
      floor: raw.floor,
      has_lift: raw.has_lift,
    };
    (map[raw.job_id] ??= []).push(entry);
  }
  return map;
}
