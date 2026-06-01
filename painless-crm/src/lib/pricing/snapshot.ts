import { type QuoteResult, calculateQuote } from '@/lib/pricing/engine';
import type { CapacityBand, PricingConfig, QuoteInput } from '@/lib/schemas/pricing';

// Pure snapshot builder. Same input + same config → same DB row payload.
// The snapshot doubles as the immutable record stored on `quotes.pricing_snapshot`
// per ADR-005; even if the source `pricing_versions` row is later edited or
// deleted, the quote retains its full computation context.

export interface QuoteSnapshotPayload {
  pricing_version_id: string;
  pricing_snapshot: {
    config: PricingConfig;
    input: QuoteInput;
    result: QuoteResult;
    computed_at: string;
  };
  size_code: string;
  distance_miles: number;
  complications: string[];
  total_pence: number;
  breakdown: QuoteResult['breakdown'];
  valid_until: string;
}

export interface BuildQuoteSnapshotArgs {
  pricingVersionId: string;
  config: PricingConfig;
  input: QuoteInput;
  computedAt?: Date;
  // The day's capacity band (Phase 07). Only modulates the price when the
  // config enables dynamic pricing and the source matches; null = no change.
  capacityBand?: CapacityBand | null;
}

export type DriftLevel = 'match' | 'minor_drift' | 'major_drift';

const MINOR_DRIFT_PCT = 0.01;

export function classifyDrift(expectedPence: number, observedPence: number): DriftLevel {
  if (expectedPence === observedPence) return 'match';
  if (expectedPence === 0) return observedPence === 0 ? 'match' : 'major_drift';
  const ratio = Math.abs(expectedPence - observedPence) / expectedPence;
  return ratio <= MINOR_DRIFT_PCT ? 'minor_drift' : 'major_drift';
}

export function buildQuoteSnapshot(args: BuildQuoteSnapshotArgs): QuoteSnapshotPayload {
  const result = calculateQuote(args.config, args.input, args.capacityBand ?? null);
  const computed = (args.computedAt ?? new Date()).toISOString();
  const validityDays = args.config.quote_validity_days;
  const validUntil = new Date(
    (args.computedAt ?? new Date()).getTime() + validityDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    pricing_version_id: args.pricingVersionId,
    pricing_snapshot: {
      config: args.config,
      input: args.input,
      result,
      computed_at: computed,
    },
    size_code: args.input.size_code,
    distance_miles: args.input.distance_miles,
    complications: [...args.input.complications],
    total_pence: result.total_pence,
    breakdown: result.breakdown,
    valid_until: validUntil,
  };
}
