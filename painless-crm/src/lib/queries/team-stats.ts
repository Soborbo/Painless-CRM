import { type WorkerStat, aggregateTeamStats } from '@/lib/reports/team-stats';
import { createClient } from '@/lib/supabase/server';

// Phase 11 §7 — gathers the inputs for the per-worker performance roll-up.
// RLS scopes everything to the company. Pure aggregation lives in
// lib/reports/team-stats.

function embedArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  return raw ? [raw as T] : [];
}

export async function getTeamStats(): Promise<WorkerStat[]> {
  const supabase = await createClient();

  const [
    { data: signoffRows },
    { data: complaintRows },
    { data: damageRows },
    { data: workerRows },
  ] = await Promise.all([
    supabase
      .from('customer_signoffs')
      .select(
        'collected_by_worker_id, job_id, internal_rating_1_5, review:review_requests(google_review_link_clicked_at)',
      )
      .is('deleted_at', null)
      .limit(5000),
    supabase.from('complaints').select('job_id').is('deleted_at', null).limit(5000),
    supabase.from('damage_claims').select('job_id').is('deleted_at', null).limit(5000),
    supabase.from('workers').select('id, full_name').is('deleted_at', null),
  ]);

  const signoffs = ((signoffRows ?? []) as unknown as Array<Record<string, unknown>>).map((s) => {
    const reviews = embedArray<{ google_review_link_clicked_at: string | null }>(s.review);
    return {
      worker_id: (s.collected_by_worker_id as string | null) ?? null,
      job_id: s.job_id as string,
      internal_rating_1_5: (s.internal_rating_1_5 as number | null) ?? null,
      review_clicked: reviews.some((r) => r.google_review_link_clicked_at != null),
    };
  });

  const complaintJobIds = ((complaintRows ?? []) as Array<{ job_id: string }>).map((r) => r.job_id);
  const damageJobIds = ((damageRows ?? []) as Array<{ job_id: string }>).map((r) => r.job_id);
  const workerNames = new Map<string, string>(
    ((workerRows ?? []) as Array<{ id: string; full_name: string }>).map((w) => [
      w.id,
      w.full_name,
    ]),
  );

  return aggregateTeamStats(signoffs, complaintJobIds, damageJobIds, workerNames);
}
