'use server';

import { requireRole } from '@/lib/auth/require-role';
import { writeBroadcastedPricing } from '@/lib/kv/pricing';
import { PricingEngineError, calculateQuote } from '@/lib/pricing/engine';
import { SMOKE_PRICING_CONFIG } from '@/lib/pricing/fixtures';
import {
  applyMatrixEdit,
  applyScalarEdit,
  parseMatrixEditForm,
  parseScalarEditForm,
  parseSimulationForm,
} from '@/lib/pricing/form';
import {
  type PricingConfig,
  type PublishPricingInput,
  PublishPricingSchema,
  type QuoteInput,
} from '@/lib/schemas/pricing';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

export type BootstrapState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; version_id: string; broadcast: 'sent' | 'deferred' }
  | { status: 'noop'; reason: 'already_seeded' };

export const INITIAL_BOOTSTRAP_STATE: BootstrapState = { status: 'idle' };

export async function bootstrapSmokePricing(): Promise<BootstrapState> {
  const me = await requireRole(PRICING_ROLES);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('pricing_versions')
    .select('id')
    .eq('company_id', me.company_id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { status: 'noop', reason: 'already_seeded' };
  }
  const result = await publishPricing({ config: SMOKE_PRICING_CONFIG, notes: 'Bootstrap seed' });
  if (result.status !== 'ok') return result;
  return { status: 'ok', version_id: result.version_id, broadcast: result.broadcast };
}

export type SimulationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      input: QuoteInput;
      result: ReturnType<typeof calculateQuote>;
      version_label: string;
    };

export const INITIAL_SIMULATION_STATE: SimulationState = { status: 'idle' };

const ACTIVE_CONFIG_COLUMNS = `
  id, version_label, margin_matrix, crew_hourly_rate_pence, van_hourly_rate_pence,
  pass_through_config, complications, size_categories, distance_bands,
  dynamic_pricing_enabled, capacity_bands, modulation_sources, quote_validity_days,
  notes
`;

async function loadActiveConfig(
  companyId: string,
): Promise<{ config: PricingConfig; label: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pricing_versions')
    .select(ACTIVE_CONFIG_COLUMNS)
    .eq('company_id', companyId)
    .is('effective_to', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    label: row.version_label as string,
    config: {
      version_label: row.version_label as string,
      margin_matrix: row.margin_matrix as number[][],
      crew_hourly_rate_pence: row.crew_hourly_rate_pence as number,
      van_hourly_rate_pence: row.van_hourly_rate_pence as number,
      pass_through_config: row.pass_through_config as PricingConfig['pass_through_config'],
      complications: row.complications as PricingConfig['complications'],
      size_categories: row.size_categories as PricingConfig['size_categories'],
      distance_bands: row.distance_bands as PricingConfig['distance_bands'],
      dynamic_pricing_enabled: (row.dynamic_pricing_enabled as boolean | null) ?? false,
      capacity_bands: (row.capacity_bands as PricingConfig['capacity_bands']) ?? undefined,
      modulation_sources: (row.modulation_sources as string[] | null) ?? undefined,
      quote_validity_days: (row.quote_validity_days as number | null) ?? 7,
      notes: (row.notes as string | null) ?? null,
    },
  };
}

export async function simulateQuote(
  _prev: SimulationState,
  form: FormData,
): Promise<SimulationState> {
  const me = await requireRole(PRICING_ROLES);

  const parseResult = parseSimulationForm(form);
  if (!parseResult.ok) {
    return { status: 'error', message: parseResult.message };
  }

  const active = await loadActiveConfig(me.company_id);
  if (!active) {
    return { status: 'error', message: 'No active pricing version. Seed one first.' };
  }

  try {
    const result = calculateQuote(active.config, parseResult.input);
    return { status: 'ok', input: parseResult.input, result, version_label: active.label };
  } catch (err) {
    if (err instanceof PricingEngineError) {
      return { status: 'error', message: err.message };
    }
    return { status: 'error', message: 'Could not run simulation' };
  }
}

export async function editPricingScalars(
  _prev: PricingActionState,
  form: FormData,
): Promise<PricingActionState> {
  const me = await requireRole(PRICING_ROLES);

  const parseResult = parseScalarEditForm(form);
  if (!parseResult.ok) {
    return { status: 'error', message: parseResult.message };
  }

  const active = await loadActiveConfig(me.company_id);
  if (!active) {
    return { status: 'error', message: 'No active pricing version. Seed one first.' };
  }

  const merged = applyScalarEdit(active.config, parseResult.input);
  const result = await publishPricing({ config: merged, notes: parseResult.input.notes ?? null });
  if (result.status !== 'ok') return result;

  redirect('/dashboard/settings/pricing');
}

export async function editPricingMatrix(
  _prev: PricingActionState,
  form: FormData,
): Promise<PricingActionState> {
  const me = await requireRole(PRICING_ROLES);

  const parseResult = parseMatrixEditForm(form);
  if (!parseResult.ok) {
    return { status: 'error', message: parseResult.message };
  }

  const active = await loadActiveConfig(me.company_id);
  if (!active) {
    return { status: 'error', message: 'No active pricing version. Seed one first.' };
  }

  const merged = applyMatrixEdit(active.config, parseResult.input);
  const result = await publishPricing({ config: merged, notes: parseResult.input.notes ?? null });
  if (result.status !== 'ok') return result;

  redirect('/dashboard/settings/pricing');
}
