import {
  ContactDetailsSchema,
  attachJobAddresses,
  createLeadJob,
  findOrCreateCustomer,
} from '@/lib/jobs/intake';
import { createQuoteForJob } from '@/lib/jobs/quote-writer';
import { writeLeadAttribution } from '@/lib/jobs/attribution';
import { z } from 'zod';

// Inbound quote webhook contract from painlessremovals calculator.
// On payloads that carry a `quote`, we also snapshot the quote row using the
// active pricing version (per ADR-005). Snapshot creation is best-effort —
// failure does not roll back the lead, but the drift status is returned for
// downstream alerting once Phase 13 lands.

// The calculator sends a single Google-formatted string + postcode rather than
// structured line1/city, so those are optional and `formatted` carries the full
// string. floor/has_lift/property_type/access_notes map to job_addresses.
const AddressSchema = z.object({
  formatted: z.string().max(300).optional(),
  line1: z.string().min(1).max(160).optional(),
  line2: z.string().max(160).optional().nullable(),
  city: z.string().min(1).max(80).optional(),
  postcode: z.string().min(2).max(12),
  floor: z.number().int().min(-2).max(100).optional(),
  has_lift: z.boolean().optional(),
  property_type: z.string().max(40).optional(),
  access_notes: z.string().max(2000).optional(),
});

// --- Rich intake blocks (all OPTIONAL, additive) ---------------------------
// Byte-aligned with painlessremovals/src/lib/crm/schemas.ts. The receiver may
// be more lenient than the sender, never stricter.
const MoveSchema = z.object({
  date: z.string().max(40).optional(),
  flexibility: z.enum(['fixed', 'flexible', 'unknown']).optional(),
});
const ServiceMetaSchema = z.object({
  type: z.enum(['home', 'office', 'clearance']).optional(),
  property_size: z.string().max(40).optional(),
  office_size: z.string().max(40).optional(),
  slider_position: z.string().max(40).optional(),
});
const ResourcesSchema = z.object({
  men: z.number().int().min(0).max(100).optional(),
  vans: z.number().int().min(0).max(100).optional(),
  cubic_ft: z.number().min(0).optional(),
  service_duration_hours: z.number().min(0).optional(),
  manual_override: z.boolean().optional(),
});
const FlagsSchema = z.object({
  property_chain: z.boolean().optional(),
  key_wait_waiver: z.boolean().optional(),
});
const ConsentSchema = z.object({
  gdpr: z.boolean().optional(),
  marketing: z.boolean().optional(),
});
const AttributionSchema = z.object({
  source: z.string().max(120).optional(),
  heard_about: z.string().max(120).optional(),
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(160).optional(),
  gclid: z.string().max(200).optional(),
  landing_page: z.string().max(500).optional(),
  session_id: z.string().max(120).optional(),
});

export const IncomingQuoteSchema = z.object({
  event_id: z.string().min(8).max(120),
  source: z.string().min(1).max(40),
  company_id: z.string().uuid(),
  customer: ContactDetailsSchema.required({ postcode: true }),
  addresses: z.object({ from: AddressSchema, to: AddressSchema }).optional(),
  quote: z
    .object({
      pricing_version_id: z.string().uuid(),
      size_code: z.string().min(1).max(40),
      distance_miles: z.number().nonnegative(),
      complications: z.array(z.string()).default([]),
      total_pence: z.number().int().nonnegative(),
    })
    .optional(),
  move: MoveSchema.optional(),
  service: ServiceMetaSchema.optional(),
  resources: ResourcesSchema.optional(),
  flags: FlagsSchema.optional(),
  consent: ConsentSchema.optional(),
  breakdown: z.record(z.string(), z.number()).optional(),
  extras: z.record(z.string(), z.any()).optional(),
  attribution: AttributionSchema.optional(),
});

export type IncomingQuote = z.infer<typeof IncomingQuoteSchema>;
export type IncomingQuoteAddress = z.infer<typeof AddressSchema>;

/** calculator serviceType → CRM jobs.service_type (migration ADR-025 enum). */
export function mapServiceType(
  t: 'home' | 'office' | 'clearance' | undefined,
): 'removal' | 'waste_clearance' | 'storage' | undefined {
  if (t === 'clearance') return 'waste_clearance';
  if (t === 'home' || t === 'office') return 'removal';
  return undefined;
}

/**
 * Post-calculation "how did you find us?" answer → CRM acquisition_source enum.
 * Only the unambiguous referral channels are mapped; organic search / social /
 * brand-awareness ("van") have no precise enum and must NOT pollute the paid
 * `google_ads`/`meta_ads` buckets, so they return undefined (the verbatim
 * answer is still kept in jobs.intake_details.attribution.heard_about).
 */
export function mapHeardAboutToSource(
  heard: string | undefined,
): 'referral' | undefined {
  if (heard === 'friend' || heard === 'estate_agent' || heard === 'returning') {
    return 'referral';
  }
  return undefined;
}

export interface IngestQuoteResult {
  customer_id: string;
  job_id: string;
  quote_id: string | null;
  drift: 'match' | 'minor_drift' | 'major_drift' | 'unobserved' | 'snapshot_failed' | null;
}

/**
 * Collect every entered item that has no dedicated jobs column into a single
 * lossless map stored on jobs.intake_details. Dedicated columns (move_date,
 * service_type, estimated_*) are NOT duplicated here.
 */
function buildIntakeDetails(payload: IncomingQuote): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  if (payload.service) {
    const { type: _omit, ...rest } = payload.service;
    if (Object.keys(rest).length > 0) details.service = rest;
  }
  if (payload.resources) {
    const { cubic_ft: _c, service_duration_hours: _d, ...rest } = payload.resources;
    if (Object.keys(rest).length > 0) details.resources = rest;
  }
  if (payload.move?.flexibility) details.date_flexibility = payload.move.flexibility;
  if (payload.flags && Object.keys(payload.flags).length > 0) details.flags = payload.flags;
  if (payload.consent && Object.keys(payload.consent).length > 0) details.consent = payload.consent;
  if (payload.breakdown && Object.keys(payload.breakdown).length > 0) {
    details.breakdown = payload.breakdown;
  }
  if (payload.extras && Object.keys(payload.extras).length > 0) details.extras = payload.extras;
  if (payload.attribution && Object.keys(payload.attribution).length > 0) {
    details.attribution = payload.attribution;
  }
  return details;
}

export async function ingestQuote(payload: IncomingQuote): Promise<IngestQuoteResult> {
  // Prefer the customer's self-reported channel ("how did you find us?") over
  // the generic transport source ('website') when it maps to a known enum.
  const effectiveSource =
    mapHeardAboutToSource(payload.attribution?.heard_about) ?? payload.source;

  const customerId = await findOrCreateCustomer({
    companyId: payload.company_id,
    contact: payload.customer,
    source: effectiveSource,
  });

  // Guard the move date — an unparseable string would fail the whole insert.
  const moveDate =
    payload.move?.date && !Number.isNaN(Date.parse(payload.move.date))
      ? new Date(payload.move.date).toISOString()
      : null;

  const jobId = await createLeadJob({
    companyId: payload.company_id,
    customerId,
    source: effectiveSource,
    quoteTotalPence: payload.quote?.total_pence ?? null,
    reason: `Webhook intake: quote (${payload.source})`,
    moveDate,
    serviceType: mapServiceType(payload.service?.type) ?? null,
    estimatedCubicFt: payload.resources?.cubic_ft ?? null,
    estimatedDistanceMiles: payload.quote?.distance_miles ?? null,
    estimatedHours: payload.resources?.service_duration_hours ?? null,
    intakeDetails: buildIntakeDetails(payload),
  });

  // Persist from/to addresses with per-leg access metadata (best-effort).
  if (payload.addresses) {
    await attachJobAddresses({
      companyId: payload.company_id,
      jobId,
      from: payload.addresses.from,
      to: payload.addresses.to,
    });
  }

  // Write the canonical attribution row (gclid/utm) linked to this lead so
  // paid-search conversions are reportable. Best-effort — never blocks the lead.
  await writeLeadAttribution({
    companyId: payload.company_id,
    jobId,
    customerId,
    source: effectiveSource,
    attribution: payload.attribution ?? null,
  });

  if (!payload.quote) {
    return { customer_id: customerId, job_id: jobId, quote_id: null, drift: null };
  }

  try {
    const snapshot = await createQuoteForJob({
      companyId: payload.company_id,
      jobId,
      pricingVersionId: payload.quote.pricing_version_id,
      input: {
        size_code: payload.quote.size_code,
        distance_miles: payload.quote.distance_miles,
        complications: payload.quote.complications,
        source: payload.source,
      },
      observedTotalPence: payload.quote.total_pence,
    });
    return {
      customer_id: customerId,
      job_id: jobId,
      quote_id: snapshot.quote_id,
      drift: snapshot.drift,
    };
  } catch (err) {
    console.warn('quote snapshot failed', err instanceof Error ? err.message : err);
    return {
      customer_id: customerId,
      job_id: jobId,
      quote_id: null,
      drift: 'snapshot_failed',
    };
  }
}
