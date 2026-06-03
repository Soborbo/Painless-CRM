import { z } from 'zod';

// Phase 25c — cubic-calculator item catalog as config-as-data (ADR-034). Stored
// on settings.cubic_presets; surfaced as quick-fill presets on the survey cubic
// sheet (name → default cubic ft). Pure: resilient read + dedupe.

export interface CubicPreset {
  name: string;
  cubic_ft: number;
}

export const MAX_PRESETS = 200;

export const CubicPresetSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required' }).max(80),
  cubic_ft: z.coerce.number().min(0).max(10_000),
});

// Keep individually-valid presets, drop malformed, dedupe by case-insensitive
// name (first wins). Never throws.
export function parseCubicPresets(raw: unknown): CubicPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: CubicPreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = CubicPresetSchema.safeParse(item);
    if (!parsed.success) continue;
    const key = parsed.data.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
    if (out.length >= MAX_PRESETS) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
