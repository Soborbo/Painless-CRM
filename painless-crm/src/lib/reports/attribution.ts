// Phase 14 §4/§5 — source attribution + lead-quality scorecard. Pure: extends
// the v0 per-source conversion with average job value, repeat rate, LTV and a
// single composite score that surfaces the sources worth paying for. The
// Supabase read lives in lib/queries/reports.ts; this is pure + testable.
//
// Cohort model matches the funnel: a job counts as a "win" once it has a
// paid_at timestamp, and its contracted value is quote_total_pence.

export interface AttributionJobRow {
  acquisition_source: string | null;
  customer_id: string | null;
  quoted_at: string | null;
  paid_at: string | null;
  quote_total_pence: number | null;
}

export interface SourceAttribution {
  source: string;
  leads: number;
  quoted: number;
  won: number;
  revenuePence: number;
  /** won / leads, 0–100, or null when no leads. */
  conversionPct: number | null;
  /** revenue / won, in pence, or null when no wins. */
  avgJobValuePence: number | null;
  /** Distinct winning customers (for LTV + repeat rate). */
  wonCustomers: number;
  /** Share of won jobs beyond the first per customer, 0–100. */
  repeatRatePct: number;
  /** Avg contracted revenue per winning customer, in pence, or null. */
  ltvPence: number | null;
  /**
   * Composite lead-quality score: conversion × avg job value (£) × repeat
   * uplift. Higher = a source worth more spend. Unitless, for ranking only.
   */
  score: number;
}

function pct(num: number, den: number): number | null {
  return den > 0 ? (num / den) * 100 : null;
}

interface Acc {
  source: string;
  leads: number;
  quoted: number;
  won: number;
  revenuePence: number;
  wonCustomerIds: Set<string>;
  wonCustomerCounts: Map<string, number>;
}

export function buildSourceAttribution(rows: readonly AttributionJobRow[]): SourceAttribution[] {
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const source = r.acquisition_source ?? 'unknown';
    let acc = map.get(source);
    if (!acc) {
      acc = {
        source,
        leads: 0,
        quoted: 0,
        won: 0,
        revenuePence: 0,
        wonCustomerIds: new Set(),
        wonCustomerCounts: new Map(),
      };
      map.set(source, acc);
    }
    acc.leads += 1;
    if (r.quoted_at) acc.quoted += 1;
    if (r.paid_at) {
      acc.won += 1;
      acc.revenuePence += r.quote_total_pence ?? 0;
      if (r.customer_id) {
        acc.wonCustomerIds.add(r.customer_id);
        acc.wonCustomerCounts.set(
          r.customer_id,
          (acc.wonCustomerCounts.get(r.customer_id) ?? 0) + 1,
        );
      }
    }
  }

  const out = [...map.values()].map((acc): SourceAttribution => {
    const conversionPct = pct(acc.won, acc.leads);
    const avgJobValuePence = acc.won > 0 ? Math.round(acc.revenuePence / acc.won) : null;
    const wonCustomers = acc.wonCustomerIds.size;
    // Won jobs beyond the first for each repeat customer, as a share of wins.
    let repeatExtra = 0;
    for (const count of acc.wonCustomerCounts.values()) repeatExtra += count - 1;
    const repeatRatePct = acc.won > 0 ? (repeatExtra / acc.won) * 100 : 0;
    const ltvPence = wonCustomers > 0 ? Math.round(acc.revenuePence / wonCustomers) : null;

    const convFraction = (conversionPct ?? 0) / 100;
    const avgValuePounds = (avgJobValuePence ?? 0) / 100;
    const repeatUplift = 1 + repeatRatePct / 100;
    const score = Math.round(convFraction * avgValuePounds * repeatUplift);

    return {
      source: acc.source,
      leads: acc.leads,
      quoted: acc.quoted,
      won: acc.won,
      revenuePence: acc.revenuePence,
      conversionPct,
      avgJobValuePence,
      wonCustomers,
      repeatRatePct,
      ltvPence,
      score,
    };
  });

  // Highest-value sources first.
  out.sort((a, b) => b.score - a.score || b.revenuePence - a.revenuePence);
  return out;
}
