import { ContactDetailsSchema, createLeadJob, findOrCreateCustomer } from '@/lib/jobs/intake';
import { z } from 'zod';

// Inbound quote webhook contract from painlessremovals calculator.
// First-slice scope: customer dedup + lead job creation. Quote snapshot
// creation lands when the manual quote builder ships in Phase 06.

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
  return { customer_id: customerId, job_id: jobId };
}
