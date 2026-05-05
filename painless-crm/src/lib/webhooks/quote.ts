import { ContactDetailsSchema, createLeadJob, findOrCreateCustomer } from '@/lib/jobs/intake';
import { createQuoteFromWebhook } from '@/lib/jobs/quote-writer';
import { z } from 'zod';

// Inbound quote webhook contract from painlessremovals calculator.
// On payloads that carry a `quote`, we also snapshot the quote row using the
// active pricing version (per ADR-005). Snapshot creation is best-effort —
// failure does not roll back the lead, but the drift status is returned for
// downstream alerting once Phase 13 lands.

const AddressSchema = z.object({
  line1: z.string().min(1).max(160),
  line2: z.string().max(160).optional().nullable(),
  city: z.string().min(1).max(80),
  postcode: z.string().min(2).max(12),
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
});

export type IncomingQuote = z.infer<typeof IncomingQuoteSchema>;

export interface IngestQuoteResult {
  customer_id: string;
  job_id: string;
  quote_id: string | null;
  drift: 'match' | 'minor_drift' | 'major_drift' | 'unobserved' | 'snapshot_failed' | null;
}

export async function ingestQuote(payload: IncomingQuote): Promise<IngestQuoteResult> {
  const customerId = await findOrCreateCustomer({
    companyId: payload.company_id,
    contact: payload.customer,
    source: payload.source,
  });
  const jobId = await createLeadJob({
    companyId: payload.company_id,
    customerId,
    source: payload.source,
    quoteTotalPence: payload.quote?.total_pence ?? null,
    reason: `Webhook intake: quote (${payload.source})`,
  });

  if (!payload.quote) {
    return { customer_id: customerId, job_id: jobId, quote_id: null, drift: null };
  }

  try {
    const snapshot = await createQuoteFromWebhook({
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
