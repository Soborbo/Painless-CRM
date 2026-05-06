// Pulls the internal cost components out of a stored pricing snapshot so the
// rep can see where the headline price came from. This is the rep-internal
// inverse of public-breakdown — margin and load/unload split are *exactly*
// what the rep wants here. Lives in /lib so the per-quote detail page can
// be a Server Component without hand-rolling the snapshot type.

export interface InternalCostRow {
  key: string;
  pence: number;
}

export interface InternalSummary {
  rows: InternalCostRow[];
  margin_pct: number | null;
  margin_modulated: boolean;
  capacity_band: string | null;
}

const COMPONENT_KEYS = [
  'crew_cost_pence',
  'van_cost_pence',
  'fuel_pence',
  'insurance_pence',
  'waste_pence',
] as const;

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function summariseInternalCost(snapshot: Record<string, unknown> | null): InternalSummary {
  const result =
    snapshot && typeof snapshot.result === 'object' && snapshot.result !== null
      ? (snapshot.result as Record<string, unknown>)
      : null;
  const breakdown =
    snapshot && typeof snapshot.result === 'object' && snapshot.result !== null
      ? ((snapshot.result as Record<string, unknown>).breakdown as
          | Record<string, unknown>
          | undefined)
      : undefined;

  const components =
    result && typeof result.components === 'object' && result.components !== null
      ? (result.components as Record<string, unknown>)
      : null;
  const rows: InternalCostRow[] = [];
  if (components) {
    for (const key of COMPONENT_KEYS) {
      const value = pickNumber(components[key]);
      if (value !== null) rows.push({ key, pence: value });
    }
  }
  if (result) {
    const margin = pickNumber(result.margin_pence);
    if (margin !== null) rows.push({ key: 'margin_pence', pence: margin });
  }

  const marginPctRaw = breakdown ? pickNumber(breakdown.margin_pct) : null;
  return {
    rows,
    margin_pct: marginPctRaw,
    margin_modulated: breakdown?.margin_modulated === true,
    capacity_band: breakdown ? pickString(breakdown.capacity_band) : null,
  };
}
