// Customer-safe slice of the engine breakdown. The full QuoteBreakdown JSONB
// includes margin_pct, load_unload_split, capacity_band and other internal
// signals — none of which belong in front of a customer. This module exposes
// only the fields that help a buyer trust the quote (size in plain English,
// crew size, estimated hours) and computes a single "all-in hours" total so
// the public page renders one number rather than two ("6 base + 1 complications"
// would invite haggling about the breakdown rather than the price).

export interface PublicBreakdown {
  size_label: string | null;
  crew_size: number | null;
  total_estimated_hours: number | null;
  requires_survey: boolean;
}

const COMPLICATION_BUCKETS = new Set(['none', 'minor', 'moderate', 'survey_required']);

function pickNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function extractPublicBreakdown(breakdown: unknown): PublicBreakdown {
  if (!breakdown || typeof breakdown !== 'object') {
    return {
      size_label: null,
      crew_size: null,
      total_estimated_hours: null,
      requires_survey: false,
    };
  }
  const b = breakdown as Record<string, unknown>;

  const baseHours = pickNumber(b.estimated_hours);
  const addedHours = pickNumber(b.hours_added_for_complications) ?? 0;
  const totalHours = baseHours === null ? null : baseHours + addedHours;

  const bucket = pickString(b.complications_bucket);
  const requires_survey =
    bucket !== null && COMPLICATION_BUCKETS.has(bucket) && bucket === 'survey_required';

  return {
    size_label: pickString(b.size_label),
    crew_size: pickNumber(b.crew_size),
    total_estimated_hours: totalHours,
    requires_survey,
  };
}
