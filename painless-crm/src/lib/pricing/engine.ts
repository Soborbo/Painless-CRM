// Pure pricing engine. Same input + same config = same output.
// Mirrors painless-crm-spec/phases/05-pricing-engine.md and the v4.2
// calculator on painlessremovals.com. Shared fixtures gate any drift.
//
// Margin convention: margin_matrix entries are gross-margin fractions in [0,1].
// Labour cost is grossed up to price as `labour / (1 - margin)`. Pass-through
// costs are added at cost (fuel, insurance, waste). Complications shift the
// estimated hours, not the price directly.

import type { CapacityBand, PricingConfig, QuoteInput } from '@/lib/schemas/pricing';

type SizeCategory = PricingConfig['size_categories'][number];
type DistanceBand = PricingConfig['distance_bands'][number];

export type ComplicationBucket = 'none' | 'minor' | 'moderate' | 'survey_required';

export interface QuoteBreakdown {
  size_code: string;
  size_label: string;
  estimated_hours: number;
  crew_size: number;
  distance_band_code: string;
  margin_pct: number;
  capacity_band: CapacityBand | null;
  margin_modulated: boolean;
  complications_points: number;
  complications_bucket: ComplicationBucket;
  hours_added_for_complications: number;
  load_unload_split: { load_hours: number; unload_hours: number };
}

export interface QuoteResult {
  total_pence: number;
  base_pence: number;
  pass_through_pence: number;
  margin_pence: number;
  components: {
    crew_cost_pence: number;
    van_cost_pence: number;
    fuel_pence: number;
    insurance_pence: number;
    waste_pence: number;
  };
  breakdown: QuoteBreakdown;
  notes: string[];
  requires_survey: boolean;
}

const LOAD_RATIO = 0.65;
const UNLOAD_RATIO = 0.35;
const MAX_MARGIN = 0.95;

export function bucketComplicationPoints(points: number): {
  bucket: ComplicationBucket;
  hours_added: number;
} {
  if (points <= 1) return { bucket: 'none', hours_added: 0 };
  if (points <= 3) return { bucket: 'minor', hours_added: 1 };
  if (points <= 5) return { bucket: 'moderate', hours_added: 2 };
  return { bucket: 'survey_required', hours_added: 2 };
}

function findSize(config: PricingConfig, sizeCode: string): { size: SizeCategory; index: number } {
  const idx = config.size_categories.findIndex((s) => s.code === sizeCode);
  const size = idx >= 0 ? config.size_categories[idx] : undefined;
  if (!size) throw new PricingEngineError(`Unknown size_code: ${sizeCode}`);
  return { size, index: idx };
}

function findDistanceBand(
  config: PricingConfig,
  miles: number,
): { band: DistanceBand; index: number } {
  const inBand = config.distance_bands.findIndex(
    (b) => miles >= b.miles_min && miles < b.miles_max,
  );
  if (inBand >= 0) {
    const band = config.distance_bands[inBand];
    if (band) return { band, index: inBand };
  }
  // Last band is inclusive of upper bound to keep the cap workable.
  const lastIdx = config.distance_bands.length - 1;
  const last = config.distance_bands[lastIdx];
  if (last && miles >= last.miles_min) return { band: last, index: lastIdx };
  throw new PricingEngineError(`Distance ${miles} miles falls outside configured bands`);
}

function sumComplicationPoints(config: PricingConfig, codes: readonly string[]): number {
  let total = 0;
  for (const code of codes) {
    const c = config.complications.find((x) => x.code === code);
    if (!c) throw new PricingEngineError(`Unknown complication code: ${code}`);
    total += c.points;
  }
  return total;
}

function clampMargin(margin: number): number {
  if (Number.isNaN(margin)) return 0;
  if (margin < 0) return 0;
  if (margin > MAX_MARGIN) return MAX_MARGIN;
  return margin;
}

export class PricingEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingEngineError';
  }
}

export function calculateQuote(
  config: PricingConfig,
  input: QuoteInput,
  capacityBand: CapacityBand | null = null,
): QuoteResult {
  const { size, index: sizeIdx } = findSize(config, input.size_code);
  const { band: distance, index: distIdx } = findDistanceBand(config, input.distance_miles);

  let margin = config.margin_matrix[sizeIdx]?.[distIdx];
  if (typeof margin !== 'number') {
    throw new PricingEngineError(
      `margin_matrix missing entry for size ${size.code} / band ${distance.code}`,
    );
  }
  let modulated = false;
  if (
    config.dynamic_pricing_enabled &&
    capacityBand &&
    config.capacity_bands &&
    input.source &&
    config.modulation_sources?.includes(input.source)
  ) {
    const band = config.capacity_bands.find((b) => b.band === capacityBand);
    if (band) {
      margin = clampMargin(margin + band.margin_delta);
      modulated = true;
    }
  }

  const points = sumComplicationPoints(config, input.complications);
  const { bucket, hours_added } = bucketComplicationPoints(points);
  const requires_survey = bucket === 'survey_required';

  const baseHours = size.estimated_hours;
  const totalHours = baseHours + hours_added;

  const crewCost = Math.round(size.crew_size * totalHours * config.crew_hourly_rate_pence);
  const vanCost = Math.round(totalHours * config.van_hourly_rate_pence);
  const labour = crewCost + vanCost;
  const labourWithMargin = Math.round(labour / (1 - margin));
  const marginPence = labourWithMargin - labour;

  const pt = config.pass_through_config;
  const fuel = Math.round(input.distance_miles * pt.fuel_per_mile_pence);
  const insurance = pt.insurance_per_job_pence;
  const waste = pt.waste_disposal_fixed_pence ?? 0;
  const passThrough = fuel + insurance + waste;

  const total = labourWithMargin + passThrough;
  const notes: string[] = [];
  if (requires_survey) notes.push('survey_required_due_to_complications');
  if (modulated) notes.push(`capacity_band_${capacityBand}_applied`);

  return {
    total_pence: total,
    base_pence: labour,
    pass_through_pence: passThrough,
    margin_pence: marginPence,
    components: {
      crew_cost_pence: crewCost,
      van_cost_pence: vanCost,
      fuel_pence: fuel,
      insurance_pence: insurance,
      waste_pence: waste,
    },
    breakdown: {
      size_code: size.code,
      size_label: size.label,
      estimated_hours: totalHours,
      crew_size: size.crew_size,
      distance_band_code: distance.code,
      margin_pct: margin,
      capacity_band: modulated ? capacityBand : null,
      margin_modulated: modulated,
      complications_points: points,
      complications_bucket: bucket,
      hours_added_for_complications: hours_added,
      load_unload_split: {
        load_hours: round1(totalHours * LOAD_RATIO),
        unload_hours: round1(totalHours * UNLOAD_RATIO),
      },
    },
    notes,
    requires_survey,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
