import { createClient } from '@/lib/supabase/server';

// Read model for the website-calculator intake captured on a job: the rich
// jobs.intake_details jsonb plus the from/to legs (job_addresses → addresses).
// Populated by the quote webhook ingestor (src/lib/webhooks/quote.ts).

export interface IntakeAddressLeg {
  role: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postcode: string | null;
  floor: number | null;
  has_lift: boolean | null;
  property_type: string | null;
  access_notes: string | null;
}

export interface JobIntake {
  move_date: string | null;
  service_type: string | null;
  details: Record<string, unknown>;
  addresses: IntakeAddressLeg[];
}

export async function getJobIntake(jobId: string): Promise<JobIntake> {
  const supabase = await createClient();

  const [{ data: job }, { data: legs }] = await Promise.all([
    supabase
      .from('jobs')
      .select('move_date, service_type, intake_details')
      .eq('id', jobId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('job_addresses')
      .select(
        'role, sequence, floor, has_lift, property_type, access_notes, address:addresses(line1, line2, city, postcode)',
      )
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .order('role', { ascending: true })
      .order('sequence', { ascending: true }),
  ]);

  const addresses: IntakeAddressLeg[] = ((legs as unknown[]) ?? []).map((raw) => {
    const l = raw as {
      role: string;
      floor: number | null;
      has_lift: boolean | null;
      property_type: string | null;
      access_notes: string | null;
      address: {
        line1: string | null;
        line2: string | null;
        city: string | null;
        postcode: string | null;
      } | null;
    };
    return {
      role: l.role,
      line1: l.address?.line1 ?? null,
      line2: l.address?.line2 ?? null,
      city: l.address?.city ?? null,
      postcode: l.address?.postcode ?? null,
      floor: l.floor,
      has_lift: l.has_lift,
      property_type: l.property_type,
      access_notes: l.access_notes,
    };
  });

  const row = (job as { move_date: string | null; service_type: string | null; intake_details: Record<string, unknown> | null } | null) ?? null;

  return {
    move_date: row?.move_date ?? null,
    service_type: row?.service_type ?? null,
    details: (row?.intake_details as Record<string, unknown>) ?? {},
    addresses,
  };
}
