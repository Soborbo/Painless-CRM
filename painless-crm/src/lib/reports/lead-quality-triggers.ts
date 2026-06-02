// Phase 16 §6 — lead-quality action triggers. Pure: from the attribution
// scorecard, decide which *paid* acquisition sources are underperforming badly
// enough to warrant pausing spend. Only ad-platform sources are "pausable" —
// you can't pause referrals or organic. Actually executing the pause is
// infra-gated (Google Ads / Meta APIs); this layer is the decision + surfacing,
// which is what the office acts on today.

import type { SourceAttribution } from '@/lib/reports/attribution';

// Sources where "pause spend" is a meaningful action.
export const PAUSABLE_SOURCES = new Set(['google_ads', 'meta_ads']);

export interface TriggerThresholds {
  /** Minimum leads before a source has enough signal to judge. */
  minLeads: number;
  /** Conversion floor (0–100); below this (with enough leads) = underperforming. */
  minConversionPct: number;
}

export const DEFAULT_TRIGGER_THRESHOLDS: TriggerThresholds = {
  minLeads: 10,
  minConversionPct: 5,
};

export interface SourceVerdict {
  source: string;
  /** True only for pausable sources that breach the thresholds. */
  underperforming: boolean;
  /** Human-readable why, or null when fine / not applicable. */
  reason: string | null;
}

export function isPausableSource(source: string): boolean {
  return PAUSABLE_SOURCES.has(source);
}

export function evaluateSource(
  s: SourceAttribution,
  thresholds: TriggerThresholds = DEFAULT_TRIGGER_THRESHOLDS,
): SourceVerdict {
  if (!isPausableSource(s.source) || s.leads < thresholds.minLeads) {
    return { source: s.source, underperforming: false, reason: null };
  }
  const conv = s.conversionPct ?? 0;
  if (conv < thresholds.minConversionPct) {
    return {
      source: s.source,
      underperforming: true,
      reason: `${s.leads} leads, ${conv.toFixed(1)}% conversion — below the ${thresholds.minConversionPct}% floor`,
    };
  }
  return { source: s.source, underperforming: false, reason: null };
}

export interface TriggerReport {
  verdicts: Map<string, SourceVerdict>;
  underperformers: SourceVerdict[];
}

export function buildTriggerReport(
  sources: readonly SourceAttribution[],
  thresholds: TriggerThresholds = DEFAULT_TRIGGER_THRESHOLDS,
): TriggerReport {
  const verdicts = new Map<string, SourceVerdict>();
  const underperformers: SourceVerdict[] = [];
  for (const s of sources) {
    const v = evaluateSource(s, thresholds);
    verdicts.set(s.source, v);
    if (v.underperforming) underperformers.push(v);
  }
  return { verdicts, underperformers };
}
