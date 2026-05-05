import { type PricingConfig, PricingConfigSchema } from '@/lib/schemas/pricing';
import { createClient } from '@/lib/supabase/server';

export interface PricingVersionRow {
  id: string;
  version_label: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  created_by: { id: string; full_name: string } | null;
}

export interface PricingVersionDetail extends PricingVersionRow {
  config: PricingConfig;
}

const VERSION_COLUMNS = `
  id, version_label, effective_from, effective_to, notes, created_at,
  created_by:users!pricing_versions_created_by_id_fkey (id, full_name)
`;

const CONFIG_COLUMNS = `
  id, version_label, effective_from, effective_to, notes, created_at,
  margin_matrix, crew_hourly_rate_pence, van_hourly_rate_pence,
  pass_through_config, complications, size_categories, distance_bands,
  dynamic_pricing_enabled, capacity_bands, modulation_sources, quote_validity_days,
  created_by:users!pricing_versions_created_by_id_fkey (id, full_name)
`;

type RawConfigRow = {
  id: string;
  version_label: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  created_by: { id: string; full_name: string } | null;
  margin_matrix: unknown;
  crew_hourly_rate_pence: number;
  van_hourly_rate_pence: number;
  pass_through_config: unknown;
  complications: unknown;
  size_categories: unknown;
  distance_bands: unknown;
  dynamic_pricing_enabled: boolean | null;
  capacity_bands: unknown;
  modulation_sources: string[] | null;
  quote_validity_days: number | null;
};

function rowToConfig(row: RawConfigRow): PricingVersionDetail {
  const config = PricingConfigSchema.parse({
    version_label: row.version_label,
    margin_matrix: row.margin_matrix,
    crew_hourly_rate_pence: row.crew_hourly_rate_pence,
    van_hourly_rate_pence: row.van_hourly_rate_pence,
    pass_through_config: row.pass_through_config,
    complications: row.complications,
    size_categories: row.size_categories,
    distance_bands: row.distance_bands,
    dynamic_pricing_enabled: row.dynamic_pricing_enabled ?? false,
    capacity_bands: row.capacity_bands ?? undefined,
    modulation_sources: row.modulation_sources ?? undefined,
    quote_validity_days: row.quote_validity_days ?? 7,
    notes: row.notes,
  });
  return {
    id: row.id,
    version_label: row.version_label,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    notes: row.notes,
    created_at: row.created_at,
    created_by: row.created_by,
    config,
  };
}

export async function listPricingVersions(): Promise<PricingVersionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pricing_versions')
    .select(VERSION_COLUMNS)
    .is('deleted_at', null)
    .order('effective_from', { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as PricingVersionRow[];
}

export async function getActivePricingVersion(): Promise<PricingVersionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pricing_versions')
    .select(CONFIG_COLUMNS)
    .is('effective_to', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  return rowToConfig(data as unknown as RawConfigRow);
}

export async function getPricingVersionById(id: string): Promise<PricingVersionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pricing_versions')
    .select(CONFIG_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  return rowToConfig(data as unknown as RawConfigRow);
}
