import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

// Attribution + affiliate-resolution helpers shared by inbound webhooks
// (calculator, contact form, affiliate landing pages, etc.). Lives next to
// intake.ts so every lead-generating surface writes attribution the same way
// — Phase 16 reporting reads exclusively from `attributions`.

export const AttributionMetaSchema = z.object({
  source: z.string().max(40).optional().nullable(),
  campaign: z.string().max(120).optional().nullable(),
  utm_source: z.string().max(80).optional().nullable(),
  utm_medium: z.string().max(80).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  gclid: z.string().max(200).optional().nullable(),
  fbclid: z.string().max(200).optional().nullable(),
  landing_page: z.string().max(500).optional().nullable(),
});

export type AttributionMeta = z.infer<typeof AttributionMetaSchema>;

export async function lookupAffiliateIdByCode(
  companyId: string,
  code: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('affiliate_codes')
    .select(
      'affiliate_id, active, affiliate:affiliates!affiliate_codes_affiliate_id_fkey (id, active, deleted_at)',
    )
    .eq('company_id', companyId)
    .eq('code', code)
    .maybeSingle();
  if (!data || data.active === false) return null;
  type AffiliateRow = { id: string; active: boolean | null; deleted_at: string | null };
  const raw = data.affiliate as unknown;
  const affiliate: AffiliateRow | null = Array.isArray(raw)
    ? ((raw[0] as AffiliateRow | undefined) ?? null)
    : ((raw as AffiliateRow | null) ?? null);
  if (!affiliate || affiliate.deleted_at !== null || affiliate.active === false) {
    return null;
  }
  return (data.affiliate_id as string | null) ?? null;
}

export async function attachAffiliateToCustomer(args: {
  companyId: string;
  customerId: string;
  affiliateId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  // Only set when currently null — never overwrite an existing attribution.
  await supabase
    .from('customers')
    .update({ affiliate_id: args.affiliateId })
    .eq('id', args.customerId)
    .eq('company_id', args.companyId)
    .is('affiliate_id', null);
}

export async function attachAffiliateToJob(args: {
  companyId: string;
  jobId: string;
  affiliateId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('jobs')
    .update({ affiliate_id: args.affiliateId })
    .eq('id', args.jobId)
    .eq('company_id', args.companyId)
    .is('affiliate_id', null);
}

export async function writeAttributionRow(args: {
  companyId: string;
  jobId?: string | null;
  customerId?: string | null;
  affiliateId?: string | null;
  affiliateCode?: string | null;
  meta: AttributionMeta;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('attributions').insert({
    company_id: args.companyId,
    job_id: args.jobId ?? null,
    customer_id: args.customerId ?? null,
    affiliate_id: args.affiliateId ?? null,
    affiliate_code: args.affiliateCode ?? null,
    source: args.meta.source ?? null,
    campaign: args.meta.campaign ?? null,
    utm_source: args.meta.utm_source ?? null,
    utm_medium: args.meta.utm_medium ?? null,
    utm_campaign: args.meta.utm_campaign ?? null,
    gclid: args.meta.gclid ?? null,
    fbclid: args.meta.fbclid ?? null,
    landing_page: args.meta.landing_page ?? null,
  });
}
