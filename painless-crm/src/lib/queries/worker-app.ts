import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';
import { DEFAULT_GPS_CLOCK_IN_THRESHOLD_M } from '@/lib/worker/gps';

// Phase 09 worker-app read layer. RLS scopes everything to the worker's company.

export type WorkerIdentity = { id: string; company_id: string; full_name: string };

export async function getWorkerForUser(userId: string): Promise<WorkerIdentity | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workers')
    .select('id, company_id, full_name')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as WorkerIdentity | null) ?? null;
}

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

export type WorkerJobCard = {
  job_id: string;
  job_number: string;
  customer_name: string;
  role: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  clocked_in: boolean;
};

const ASSIGNMENT_COLS =
  'job_id, role, scheduled_start, scheduled_end, job:jobs (job_number, customer:customers (customer_type, first_name, last_name, company_name, primary_email))';

export async function getTodaysAssignments(
  workerId: string,
  date: string,
): Promise<WorkerJobCard[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: clockIns }] = await Promise.all([
    supabase
      .from('job_assignments')
      .select(ASSIGNMENT_COLS)
      .eq('worker_id', workerId)
      .eq('date', date)
      .is('deleted_at', null)
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('time_entries')
      .select('job_id')
      .eq('worker_id', workerId)
      .eq('type', 'clock_in')
      .gte('occurred_at', `${date}T00:00:00.000Z`)
      .lte('occurred_at', `${date}T23:59:59.999Z`)
      .is('deleted_at', null),
  ]);

  const clockedInJobs = new Set(
    ((clockIns ?? []) as Array<{ job_id: string }>).map((r) => r.job_id),
  );

  return ((rows ?? []) as Array<Record<string, unknown>>).map((raw) => {
    const job = embedOne<{ job_number: string; customer: unknown }>(raw.job);
    const customer = embedOne<Parameters<typeof customerDisplayName>[0]>(job?.customer);
    const jobId = raw.job_id as string;
    return {
      job_id: jobId,
      job_number: job?.job_number ?? '—',
      customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
      role: (raw.role as string | null) ?? null,
      scheduled_start: (raw.scheduled_start as string | null) ?? null,
      scheduled_end: (raw.scheduled_end as string | null) ?? null,
      clocked_in: clockedInJobs.has(jobId),
    };
  });
}

export type WorkerJobDetail = {
  job_id: string;
  job_number: string;
  customer_name: string;
  customer_phone: string | null;
  from_address: { line1: string; city: string; postcode: string } | null;
  from_lat: number | null;
  from_lng: number | null;
  clocked_in: boolean;
};

const JOB_DETAIL_COLS =
  'job_number, customer:customers (customer_type, first_name, last_name, company_name, primary_email, primary_phone)';

// The job's origin ('from') address — the site the worker clocks in at.
async function getFromAddress(supabase: Awaited<ReturnType<typeof createClient>>, jobId: string) {
  const { data } = await supabase
    .from('job_addresses')
    .select('address:addresses (line1, city, postcode, latitude, longitude)')
    .eq('job_id', jobId)
    .eq('role', 'from')
    .is('deleted_at', null)
    .order('sequence', { ascending: true })
    .limit(1)
    .maybeSingle();
  return embedOne<{
    line1: string;
    city: string;
    postcode: string;
    latitude: number | null;
    longitude: number | null;
  }>((data as Record<string, unknown> | null)?.address);
}

export async function getWorkerJobDetail(
  jobId: string,
  workerId: string,
  date: string,
): Promise<WorkerJobDetail | null> {
  const supabase = await createClient();

  // Confirm the worker is actually assigned to this job before exposing it.
  const { data: assignment } = await supabase
    .from('job_assignments')
    .select('id')
    .eq('worker_id', workerId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!assignment) return null;

  const [{ data: jobRow }, fromAddress, { data: clockIn }] = await Promise.all([
    supabase
      .from('jobs')
      .select(JOB_DETAIL_COLS)
      .eq('id', jobId)
      .is('deleted_at', null)
      .maybeSingle(),
    getFromAddress(supabase, jobId),
    supabase
      .from('time_entries')
      .select('id')
      .eq('worker_id', workerId)
      .eq('job_id', jobId)
      .eq('type', 'clock_in')
      .gte('occurred_at', `${date}T00:00:00.000Z`)
      .lte('occurred_at', `${date}T23:59:59.999Z`)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle(),
  ]);
  if (!jobRow) return null;

  const raw = jobRow as Record<string, unknown>;
  const customer = embedOne<
    Parameters<typeof customerDisplayName>[0] & { primary_phone: string | null }
  >(raw.customer);

  return {
    job_id: jobId,
    job_number: raw.job_number as string,
    customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
    customer_phone: customer?.primary_phone ?? null,
    from_address: fromAddress
      ? { line1: fromAddress.line1, city: fromAddress.city, postcode: fromAddress.postcode }
      : null,
    from_lat: fromAddress?.latitude ?? null,
    from_lng: fromAddress?.longitude ?? null,
    clocked_in: Boolean(clockIn),
  };
}

// Time entries the worker has recorded for a job today (type + when), for the
// job-progress stepper.
export async function getRecordedTimeEntries(
  workerId: string,
  jobId: string,
  date: string,
): Promise<Array<{ type: string | null; occurred_at: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('time_entries')
    .select('type, occurred_at')
    .eq('worker_id', workerId)
    .eq('job_id', jobId)
    .gte('occurred_at', `${date}T00:00:00.000Z`)
    .lte('occurred_at', `${date}T23:59:59.999Z`)
    .is('deleted_at', null);
  return (data ?? []) as Array<{ type: string | null; occurred_at: string }>;
}

// The vehicle this worker is assigned to drive/use on the job (from the rota).
// Null when no vehicle is on their assignment — then there's no pre-check to do.
export async function getAssignedVehicle(
  workerId: string,
  jobId: string,
): Promise<{ vehicle_id: string; registration: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_assignments')
    .select('vehicle_id, vehicle:vehicles (registration)')
    .eq('worker_id', workerId)
    .eq('job_id', jobId)
    .not('vehicle_id', 'is', null)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!data?.vehicle_id) return null;
  const vehicle = embedOne<{ registration: string }>((data as Record<string, unknown>).vehicle);
  return { vehicle_id: data.vehicle_id as string, registration: vehicle?.registration ?? '—' };
}

// Whether a vehicle pre-check exists for this worker/vehicle/job today.
export async function hasVehicleCheck(
  workerId: string,
  vehicleId: string,
  jobId: string,
  date: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('vehicle_checks')
    .select('id')
    .eq('worker_id', workerId)
    .eq('vehicle_id', vehicleId)
    .eq('job_id', jobId)
    .eq('date', date)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// Whether this worker has already submitted an end-of-job sheet for the job
// (a sheet is a one-off, not per-day).
export async function hasJobSheet(workerId: string, jobId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_sheets')
    .select('id')
    .eq('worker_id', workerId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// Per-company clock-in distance threshold (metres), from settings.feature_flags,
// falling back to the default. Admin-scoped read (the action has the company id).
export async function getGpsThresholdForCompany(companyId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('feature_flags')
    .eq('company_id', companyId)
    .maybeSingle();
  const flags = (data as { feature_flags: Record<string, unknown> | null } | null)?.feature_flags;
  const raw = flags?.gps_clock_in_threshold_m;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GPS_CLOCK_IN_THRESHOLD_M;
}
