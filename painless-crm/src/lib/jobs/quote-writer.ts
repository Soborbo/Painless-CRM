import { buildQuoteSnapshot, classifyDrift } from '@/lib/pricing/snapshot';
import { PricingConfigSchema, type QuoteInput } from '@/lib/schemas/pricing';
import { createAdminClient } from '@/lib/supabase/admin';

// Loads the named pricing_versions row, runs the engine, writes a `quotes`
// row with an immutable snapshot, and updates the parent job's quote totals.
// Called from inbound webhooks (Phase 05) and the manual quote builder
// (Phase 06+); the boundary is intentionally narrow so the audit + drift logic
// stays in one place.

export interface CreateQuoteForJobArgs {
  companyId: string;
  jobId: string;
  pricingVersionId: string;
  input: QuoteInput;
  observedTotalPence?: number | null;
  revisedFromId?: string | null;
}

export interface CreateQuoteResult {
  quote_id: string;
  total_pence: number;
  drift: 'match' | 'minor_drift' | 'major_drift' | 'unobserved';
  valid_until: string;
  revision_number: number;
}

async function loadPricingVersion(companyId: string, versionId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('pricing_versions')
    .select(
      `id, version_label, margin_matrix, crew_hourly_rate_pence, van_hourly_rate_pence,
       pass_through_config, complications, size_categories, distance_bands,
       dynamic_pricing_enabled, capacity_bands, modulation_sources, quote_validity_days, notes`,
    )
    .eq('company_id', companyId)
    .eq('id', versionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const config = PricingConfigSchema.parse({
    version_label: row.version_label,
    margin_matrix: row.margin_matrix,
    crew_hourly_rate_pence: row.crew_hourly_rate_pence,
    van_hourly_rate_pence: row.van_hourly_rate_pence,
    pass_through_config: row.pass_through_config,
    complications: row.complications,
    size_categories: row.size_categories,
    distance_bands: row.distance_bands,
    dynamic_pricing_enabled: (row.dynamic_pricing_enabled as boolean | null) ?? false,
    capacity_bands: row.capacity_bands ?? undefined,
    modulation_sources: (row.modulation_sources as string[] | null) ?? undefined,
    quote_validity_days: (row.quote_validity_days as number | null) ?? 7,
    notes: (row.notes as string | null) ?? null,
  });
  return { id: row.id as string, config };
}

async function loadRevisionParent(companyId: string, jobId: string, parentId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('quotes')
    .select('id, job_id, company_id, revision_number')
    .eq('id', parentId)
    .eq('company_id', companyId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .maybeSingle();
  return data as { id: string; revision_number: number | null } | null;
}

export async function createQuoteForJob(args: CreateQuoteForJobArgs): Promise<CreateQuoteResult> {
  const supabase = createAdminClient();
  const version = await loadPricingVersion(args.companyId, args.pricingVersionId);
  if (!version) {
    throw new Error(`Pricing version not found: ${args.pricingVersionId}`);
  }

  let revisedFromId: string | null = null;
  let revisionNumber = 1;
  if (args.revisedFromId) {
    const parent = await loadRevisionParent(args.companyId, args.jobId, args.revisedFromId);
    if (!parent) throw new Error('Source quote not found for revision');
    revisedFromId = parent.id;
    revisionNumber = (parent.revision_number ?? 1) + 1;
  }

  const snapshot = buildQuoteSnapshot({
    pricingVersionId: version.id,
    config: version.config,
    input: args.input,
  });

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      company_id: args.companyId,
      job_id: args.jobId,
      pricing_version_id: snapshot.pricing_version_id,
      pricing_snapshot: snapshot.pricing_snapshot,
      size_code: snapshot.size_code,
      distance_miles: snapshot.distance_miles,
      complications: snapshot.complications,
      total_pence: snapshot.total_pence,
      breakdown: snapshot.breakdown,
      status: 'draft',
      valid_until: snapshot.valid_until,
      revised_from_id: revisedFromId,
      revision_number: revisionNumber,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Could not create quote: ${error?.message ?? 'unknown'}`);
  }

  await supabase
    .from('jobs')
    .update({ quote_total_pence: snapshot.total_pence })
    .eq('id', args.jobId)
    .eq('company_id', args.companyId);

  const drift =
    typeof args.observedTotalPence === 'number'
      ? classifyDrift(snapshot.total_pence, args.observedTotalPence)
      : 'unobserved';

  return {
    quote_id: data.id as string,
    total_pence: snapshot.total_pence,
    drift,
    valid_until: snapshot.valid_until,
    revision_number: revisionNumber,
  };
}
