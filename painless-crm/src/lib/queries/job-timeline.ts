import {
  type CallHistoryRow,
  type NoteHistoryRow,
  type QuoteAcceptanceHistoryRow,
  type QuoteHistoryRow,
  type StageHistoryRow,
  type TimelineEvent,
  mergeJobTimeline,
} from '@/lib/jobs/timeline-merge';
import { createClient } from '@/lib/supabase/server';

// Reads each timeline source via RLS (server client) and feeds the rows
// through the pure merger. Quote acceptances are fetched via a join on
// quotes.job_id so this single function can serve the whole timeline page.

export async function getJobTimeline(jobId: string): Promise<TimelineEvent[]> {
  const supabase = await createClient();

  const [stages, notes, calls, quotes, acceptances] = await Promise.all([
    supabase
      .from('job_status_history')
      .select(
        'changed_at, from_stage, to_stage, reason, changed_by:users!job_status_history_changed_by_id_fkey (full_name)',
      )
      .eq('job_id', jobId)
      .order('changed_at', { ascending: false })
      .limit(200),
    supabase
      .from('notes')
      .select(
        'created_at, body, is_customer_visible, created_by:users!notes_created_by_id_fkey (full_name)',
      )
      .eq('parent_type', 'job')
      .eq('parent_id', jobId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('phone_calls')
      .select(
        'occurred_at, direction, duration_seconds, user:users!phone_calls_user_id_fkey (full_name)',
      )
      .eq('job_id', jobId)
      .order('occurred_at', { ascending: false })
      .limit(200),
    supabase
      .from('quotes')
      .select('id, created_at, sent_at, total_pence, status')
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('quote_acceptances')
      .select('quote_id, accepted_at, consents, quote:quotes!inner(job_id)')
      .eq('quote.job_id', jobId)
      .order('accepted_at', { ascending: false })
      .limit(50),
  ]);

  return mergeJobTimeline({
    stages: (stages.data ?? []) as unknown as StageHistoryRow[],
    notes: (notes.data ?? []) as unknown as NoteHistoryRow[],
    calls: (calls.data ?? []) as unknown as CallHistoryRow[],
    quotes: (quotes.data ?? []) as unknown as QuoteHistoryRow[],
    acceptances: (acceptances.data ?? []) as unknown as QuoteAcceptanceHistoryRow[],
  });
}
