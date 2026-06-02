// Phase 16 §8 — customer health score. Pure + tested. A 0–100 composite of
// three signals, chosen to flag churn risk for proactive outreach:
//   - satisfaction (last sign-off NPS, 0–10)  → up to 50 pts
//   - recency (days since last job activity)   → up to 35 pts
//   - active storage (recurring relationship)  → 15 pts
// When NPS is unknown we award a neutral half rather than penalising — a
// customer with no survey isn't necessarily unhappy.

export interface HealthInput {
  lastNps: number | null; // 0–10
  daysSinceActivity: number | null;
  hasActiveStorage: boolean;
}

export type HealthBand = 'good' | 'at_risk' | 'churn_risk';

export interface HealthResult {
  score: number; // 0–100
  band: HealthBand;
}

const NPS_WEIGHT = 50;
const RECENCY_WEIGHT = 35;
const STORAGE_WEIGHT = 15;
const RECENCY_FRESH_DAYS = 30;
const RECENCY_STALE_DAYS = 365;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function npsPoints(lastNps: number | null): number {
  if (lastNps == null) return NPS_WEIGHT / 2; // neutral when unknown
  return (clamp(lastNps, 0, 10) / 10) * NPS_WEIGHT;
}

function recencyPoints(days: number | null): number {
  if (days == null) return 0; // never active
  if (days <= RECENCY_FRESH_DAYS) return RECENCY_WEIGHT;
  if (days >= RECENCY_STALE_DAYS) return 0;
  const span = RECENCY_STALE_DAYS - RECENCY_FRESH_DAYS;
  return RECENCY_WEIGHT * (1 - (days - RECENCY_FRESH_DAYS) / span);
}

export function bandFor(score: number): HealthBand {
  if (score >= 70) return 'good';
  if (score >= 40) return 'at_risk';
  return 'churn_risk';
}

export function computeHealthScore(input: HealthInput): HealthResult {
  const raw =
    npsPoints(input.lastNps) +
    recencyPoints(input.daysSinceActivity) +
    (input.hasActiveStorage ? STORAGE_WEIGHT : 0);
  const score = clamp(Math.round(raw), 0, 100);
  return { score, band: bandFor(score) };
}
