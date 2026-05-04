import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

// Inbound B2B partner / affiliate self-registration. The partner submits a
// short form on painlessremovals.com; we create an `affiliates` row in
// `active = false` so admins can review the application before it goes live.
// Phase 16 wires the approval flow + commission_config negotiation.

export const PARTNER_TYPES = ['estate_agent', 'B2B_partner', 'individual', 'other'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

const ukPhone = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[+0-9 ()-]+$/);

export const IncomingPartnerRegisterSchema = z.object({
  event_id: z.string().min(8).max(120),
  source: z.string().min(1).max(40),
  company_id: z.string().uuid(),
  partner: z.object({
    name: z.string().trim().min(1).max(160),
    type: z.enum(PARTNER_TYPES).default('B2B_partner'),
    contact_name: z.string().trim().min(1).max(160),
    contact_email: z.string().email().max(160),
    contact_phone: ukPhone,
    website: z.string().url().max(500).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  }),
  proposed_commission: z
    .object({
      type: z.enum(['percent_revenue', 'flat_per_job', 'tiered']),
      value: z.number().nonnegative().max(10_000).optional().nullable(),
      currency: z.string().length(3).default('GBP'),
    })
    .optional(),
});

export type IncomingPartnerRegister = z.infer<typeof IncomingPartnerRegisterSchema>;

export interface IngestPartnerRegisterResult {
  affiliate_id: string;
  duplicate: boolean;
}

async function findExistingAffiliate(companyId: string, email: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('affiliates')
    .select('id')
    .eq('company_id', companyId)
    .eq('contact_email', email)
    .is('deleted_at', null)
    .maybeSingle();
  return (data?.id as string | null) ?? null;
}

export async function ingestPartnerRegister(
  payload: IncomingPartnerRegister,
): Promise<IngestPartnerRegisterResult> {
  const supabase = createAdminClient();
  const existing = await findExistingAffiliate(payload.company_id, payload.partner.contact_email);
  if (existing) return { affiliate_id: existing, duplicate: true };

  const commission = payload.proposed_commission;
  const { data, error } = await supabase
    .from('affiliates')
    .insert({
      company_id: payload.company_id,
      name: payload.partner.name,
      type: payload.partner.type,
      contact_name: payload.partner.contact_name,
      contact_email: payload.partner.contact_email,
      contact_phone: payload.partner.contact_phone,
      commission_type: commission?.type ?? null,
      commission_value: commission?.value ?? null,
      commission_config: commission
        ? { currency: commission.currency, source: payload.source }
        : null,
      active: false,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Could not register partner: ${error?.message ?? 'unknown'}`);
  }
  return { affiliate_id: data.id as string, duplicate: false };
}
