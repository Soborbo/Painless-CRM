import { WORKER_PAGE_SIZE, type WorkerListFilters } from '@/lib/schemas/worker';
import { createClient } from '@/lib/supabase/server';
import { type WorkerPerformance, summariseWorkerPerformance } from '@/lib/workers/performance';

export type WorkerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  hourly_rate_pence: number | null;
  skills: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type WorkerListResult = {
  rows: WorkerRow[];
  total: number;
  page: number;
  pageSize: number;
};

const COLUMNS =
  'id, full_name, phone, email, hourly_rate_pence, skills, active, notes, created_at, updated_at, version';

export async function listWorkers(filters: WorkerListFilters): Promise<WorkerListResult> {
  const supabase = await createClient();
  const page = filters.page;
  const from = (page - 1) * WORKER_PAGE_SIZE;
  const to = from + WORKER_PAGE_SIZE - 1;

  let query = supabase
    .from('workers')
    .select(COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .range(from, to);

  if (filters.active === 'active') query = query.eq('active', true);
  if (filters.active === 'inactive') query = query.eq('active', false);

  const { data, count } = await query;
  return {
    rows: (data ?? []) as WorkerRow[],
    total: count ?? 0,
    page,
    pageSize: WORKER_PAGE_SIZE,
  };
}

export async function getWorkerById(id: string): Promise<WorkerRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workers')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as WorkerRow | null) ?? null;
}

export async function getWorkerPerformance(workerId: string): Promise<WorkerPerformance> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_assignments')
    .select('job_id, role')
    .eq('worker_id', workerId)
    .is('deleted_at', null);
  return summariseWorkerPerformance((data ?? []) as Array<{ job_id: string; role: string | null }>);
}

export type AvailabilityRow = {
  date: string;
  available: boolean;
  notes: string | null;
};

// Submitted availability from today onward (the worker PWA poll lands in Phase
// 09; this is the read view). Capped to the next stretch of entries.
export async function getUpcomingAvailability(
  workerId: string,
  fromDate: string,
  limit = 60,
): Promise<AvailabilityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('worker_availability')
    .select('date, available, notes')
    .eq('worker_id', workerId)
    .gte('date', fromDate)
    .order('date', { ascending: true })
    .limit(limit);
  return (data ?? []) as AvailabilityRow[];
}
