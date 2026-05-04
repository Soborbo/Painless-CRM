import { ACQUISITION_SOURCES } from '@/lib/schemas/job';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

// Inbound quote webhook contract.
// The full ingest flow (AI dedup, attribution, automation rules, server-side
// mirror tracking) lands across Phase 05 → Phase 13. This first slice creates
// or matches the customer and a `lead` job so the lead actually shows up in
// the dashboard. Quote snapshot creation is deferred until the manual quote
// builder lands in Phase 06.

const ukPhone = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[+0-9 ()-]+$/);

export const IncomingQuoteSchema = z.object({
  event_id: z.string().min(8).max(120),
  source: z.string().min(1).max(40),
  company_id: z.string().uuid(),
  customer: z.object({
    full_name: z.string().min(1).max(160),
    email: z.string().email().max(160),
    phone: ukPhone,
    postcode: z.string().min(2).max(12),
  }),
  addresses: z
    .object({
      from: z.object({
        line1: z.string().min(1).max(160),
        line2: z.string().max(160).optional().nullable(),
        city: z.string().min(1).max(80),
        postcode: z.string().min(2).max(12),
      }),
      to: z.object({
        line1: z.string().min(1).max(160),
        line2: z.string().max(160).optional().nullable(),
        city: z.string().min(1).max(80),
        postcode: z.string().min(2).max(12),
      }),
    })
    .optional(),
  quote: z
    .object({
      pricing_version_id: z.string().uuid(),
      size_code: z.string().min(1).max(40),
      distance_miles: z.number().nonnegative(),
      complications: z.array(z.string()).default([]),
      total_pence: z.number().int().nonnegative(),
    })
    .optional(),
});

export type IncomingQuote = z.infer<typeof IncomingQuoteSchema>;

export interface IngestQuoteResult {
  customer_id: string;
  job_id: string;
}

function splitName(fullName: string): { first: string | null; last: string | null } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first: null, last: null };
  const [first, ...rest] = trimmed.split(/\s+/);
  if (!first) return { first: null, last: null };
  if (rest.length === 0) return { first, last: null };
  return { first, last: rest.join(' ') };
}

function normaliseSource(source: string): string {
  const found = ACQUISITION_SOURCES.find((s) => s === source);
  return found ?? 'website';
}

async function nextJobNumber(companyId: string): Promise<string> {
  const supabase = createAdminClient();
  const year = new Date().getUTCFullYear();
  const { data } = await supabase
    .from('jobs')
    .select('job_number')
    .eq('company_id', companyId)
    .ilike('job_number', `J${year}-%`)
    .order('job_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  let next = 1;
  if (data?.job_number) {
    const match = /J\d{4}-(\d+)/.exec(data.job_number as string);
    if (match?.[1]) next = Number.parseInt(match[1], 10) + 1;
  }
  return `J${year}-${String(next).padStart(5, '0')}`;
}

async function findOrCreateCustomer(payload: IncomingQuote): Promise<string> {
  const supabase = createAdminClient();
  const { customer, company_id } = payload;
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', company_id)
    .eq('primary_email', customer.email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { first, last } = splitName(customer.full_name);
  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_id,
      customer_type: 'individual',
      first_name: first,
      last_name: last,
      primary_email: customer.email,
      primary_phone: customer.phone,
      acquisition_source: normaliseSource(payload.source),
      first_contact_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Could not create customer: ${error?.message ?? 'unknown'}`);
  }
  return data.id as string;
}

export async function ingestQuote(payload: IncomingQuote): Promise<IngestQuoteResult> {
  const supabase = createAdminClient();
  const customerId = await findOrCreateCustomer(payload);
  const jobNumber = await nextJobNumber(payload.company_id);
  const enquiryAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      company_id: payload.company_id,
      job_number: jobNumber,
      customer_id: customerId,
      stage: 'lead',
      acquisition_source: normaliseSource(payload.source),
      enquiry_at: enquiryAt,
      quote_total_pence: payload.quote?.total_pence ?? null,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Could not create job: ${error?.message ?? 'unknown'}`);
  }
  await supabase.from('job_status_history').insert({
    company_id: payload.company_id,
    job_id: data.id,
    from_stage: null,
    to_stage: 'lead',
    reason: `Webhook intake: ${payload.source}`,
  });
  return { customer_id: customerId, job_id: data.id as string };
}
