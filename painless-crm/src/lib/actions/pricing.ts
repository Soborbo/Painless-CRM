'use server';

import { requireRole } from '@/lib/auth/require-role';
import { writeBroadcastedPricing } from '@/lib/kv/pricing';
import { type PublishPricingInput, PublishPricingSchema } from '@/lib/schemas/pricing';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const PRICING_ROLES = ['admin', 'manager', 'super_admin'] as const;

export type PricingActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; version_id: string; broadcast: 'sent' | 'deferred' };

export const INITIAL_PRICING_STATE: PricingActionState = { status: 'idle' };

export async function publishPricing(input: PublishPricingInput): Promise<PricingActionState> {
  const me = await requireRole(PRICING_ROLES);
  const parsed = PublishPricingSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid pricing' };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: current } = await supabase
    .from('pricing_versions')
    .select('id')
    .eq('company_id', me.company_id)
    .is('effective_to', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (current) {
    const { error: closeErr } = await supabase
      .from('pricing_versions')
      .update({ effective_to: now })
      .eq('id', current.id);
    if (closeErr) {
      return { status: 'error', message: 'Could not close active pricing version' };
    }
  }

  const { config, notes } = parsed.data;
  const { data: row, error } = await supabase
    .from('pricing_versions')
    .insert({
      company_id: me.company_id,
      version_label: config.version_label,
      effective_from: now,
      effective_to: null,
      margin_matrix: config.margin_matrix,
      crew_hourly_rate_pence: config.crew_hourly_rate_pence,
      van_hourly_rate_pence: config.van_hourly_rate_pence,
      pass_through_config: config.pass_through_config,
      complications: config.complications,
      size_categories: config.size_categories,
      distance_bands: config.distance_bands,
      dynamic_pricing_enabled: config.dynamic_pricing_enabled,
      capacity_bands: config.capacity_bands ?? null,
      modulation_sources: config.modulation_sources ?? null,
      quote_validity_days: config.quote_validity_days,
      notes: notes ?? null,
      created_by_id: me.id,
    })
    .select('id')
    .single();
  if (error || !row) {
    return { status: 'error', message: 'Could not save pricing version' };
  }

  const broadcast = await writeBroadcastedPricing(me.company_id, {
    config,
    version_id: row.id,
    published_at: now,
  });

  revalidatePath('/dashboard/settings/pricing');
  return {
    status: 'ok',
    version_id: row.id,
    broadcast: broadcast.ok ? 'sent' : 'deferred',
  };
}
