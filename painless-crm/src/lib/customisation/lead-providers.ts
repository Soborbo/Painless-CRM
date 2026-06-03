import { z } from 'zod';

// Phase 26 — lead-provider → acquisition_source mapping as config-as-data
// (ADR-035). Stored on settings.lead_provider_config. The actual inbound
// webhook ingestion is infra-gated; this is the mapping the intake/attribution
// path consults to normalise an incoming provider name to a source key.

export interface LeadProvider {
  name: string; // inbound provider label, e.g. "Compare My Move"
  source_key: string; // acquisition_source key, e.g. "compare_my_move"
  active: boolean;
}

export const MAX_PROVIDERS = 100;

export const LeadProviderSchema = z.object({
  name: z.string().trim().min(1, { message: 'Provider name is required' }).max(80),
  source_key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,39}$/, { message: 'source_key must be lower_snake_case' }),
  active: z.boolean().optional().default(true),
});

export function parseLeadProviders(raw: unknown): LeadProvider[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadProvider[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = LeadProviderSchema.safeParse(item);
    if (!parsed.success) continue;
    const key = parsed.data.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
    if (out.length >= MAX_PROVIDERS) break;
  }
  return out;
}

// Resolve an inbound provider name to its source key (active mappings only).
// Case-insensitive on the provider name; null when unmapped.
export function resolveSourceForProvider(
  providers: readonly LeadProvider[],
  providerName: string,
): string | null {
  const needle = providerName.trim().toLowerCase();
  const match = providers.find((p) => p.active && p.name.toLowerCase() === needle);
  return match ? match.source_key : null;
}
