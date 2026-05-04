import {
  AttributionMetaSchema,
  attachAffiliateToCustomer,
  attachAffiliateToJob,
  lookupAffiliateIdByCode,
  writeAttributionRow,
} from '@/lib/jobs/attribution';
import { ContactDetailsSchema, createLeadJob, findOrCreateCustomer } from '@/lib/jobs/intake';
import { z } from 'zod';

// Inbound affiliate-attributed lead. Source surfaces are typically partner
// landing pages (`?ref=foo123`) or the calculator with an affiliate cookie.
// The affiliate_code is mandatory; if it cannot be resolved to an active
// affiliate row we still create the lead and write the bare code into
// `attributions` so reporting can chase it later.

export const IncomingAffiliateSchema = z.object({
  event_id: z.string().min(8).max(120),
  source: z.string().min(1).max(40),
  company_id: z.string().uuid(),
  affiliate_code: z.string().trim().min(1).max(80),
  customer: ContactDetailsSchema,
  message: z.string().trim().max(2000).optional().nullable(),
  attribution: AttributionMetaSchema.optional(),
});

export type IncomingAffiliate = z.infer<typeof IncomingAffiliateSchema>;

export interface IngestAffiliateResult {
  customer_id: string;
  job_id: string;
  affiliate_id: string | null;
  resolved: boolean;
}

function buildNotes(payload: IncomingAffiliate, resolved: boolean): string {
  const parts: string[] = [`Affiliate referral: ${payload.affiliate_code}`];
  if (!resolved) parts.push('(code not matched — review needed)');
  if (payload.message?.trim()) parts.push(`Message: ${payload.message.trim()}`);
  return parts.join('\n');
}

export async function ingestAffiliate(payload: IncomingAffiliate): Promise<IngestAffiliateResult> {
  const customerId = await findOrCreateCustomer({
    companyId: payload.company_id,
    contact: payload.customer,
    source: payload.source,
  });
  const affiliateId = await lookupAffiliateIdByCode(payload.company_id, payload.affiliate_code);
  if (affiliateId) {
    await attachAffiliateToCustomer({
      companyId: payload.company_id,
      customerId,
      affiliateId,
    });
  }
  const jobId = await createLeadJob({
    companyId: payload.company_id,
    customerId,
    source: payload.source,
    notes: buildNotes(payload, affiliateId !== null),
    reason: `Webhook intake: affiliate (${payload.source})`,
  });
  if (affiliateId) {
    await attachAffiliateToJob({
      companyId: payload.company_id,
      jobId,
      affiliateId,
    });
  }
  await writeAttributionRow({
    companyId: payload.company_id,
    jobId,
    customerId,
    affiliateId,
    affiliateCode: payload.affiliate_code,
    meta: payload.attribution ?? {},
  });
  return {
    customer_id: customerId,
    job_id: jobId,
    affiliate_id: affiliateId,
    resolved: affiliateId !== null,
  };
}
