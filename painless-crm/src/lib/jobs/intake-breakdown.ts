// Format the website-calculator price breakdown captured on a job's intake.
//
// The calculator (painlessremovals v4.2, src/lib/calculator-logic.ts) emits this
// map in WHOLE POUNDS — NOT pence — and mixes non-currency fields into it (a
// margin multiplier, an extra-crew headcount, an access-difficulty percentage).
// Rendering it raw made it unreadable (camelCase keys) and wrong (pence-formatted
// pounds, ratio shown as £0).
//
// This produces a clean, itemised cost sheet: real line items (crew, vans,
// surcharge, mileage, key-wait waiver, each requested extra, clearance disposal),
// then Margin (profit), then Total. The internal mechanics the office did not
// recognise — controllable cost, margin multiplier, margined total, pass-through
// total, subtotal — are hidden. Per-extra lines (packing/cleaning/storage/
// assembly) and `total` are sent by the calculator (single pricing source); until
// the site emits them, the lumped `extrasCost` shows as a fallback. Unknown future
// keys fall back to a humanised label, formatted as pounds.

const GBP_WHOLE = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

type Unit = 'gbp' | 'multiplier' | 'count' | 'percent';

interface BreakdownField {
  label: string;
  unit: Unit;
  /** Internal aggregate the office does not need — never rendered. */
  hidden?: boolean;
  /** Rendered bold and last (the grand total). */
  emphasis?: boolean;
}

// Keys + labels mirror painlessremovals calculator-logic.ts (removal v4.2 and
// house-clearance breakdown shapes), the customer-facing labels in Step12Quote.tsx,
// and the per-extra config in calculator-config.ts. Insertion order is display
// order: real line items → margin → total.
const FIELDS: Record<string, BreakdownField> = {
  crewCost: { label: 'Crew cost', unit: 'gbp' },
  vansCost: { label: 'Vans', unit: 'gbp' },
  surchargeCost: { label: 'Surcharge (Saturday / bank holiday)', unit: 'gbp' },
  mileageCost: { label: 'Mileage', unit: 'gbp' },
  keyWaitWaiverCost: { label: 'Key Wait Waiver', unit: 'gbp' },
  // Per-extra line items (emitted by the calculator once itemised intake ships).
  packing: { label: 'Packing', unit: 'gbp' },
  cleaning: { label: 'Cleaning', unit: 'gbp' },
  storage: { label: 'Storage', unit: 'gbp' },
  assembly: { label: 'Assembly / disassembly', unit: 'gbp' },
  // Lumped extras total — fallback shown only when no per-extra line is present.
  extrasCost: { label: 'Extra services', unit: 'gbp' },
  // House-clearance line items.
  disposalCost: { label: 'Disposal fees', unit: 'gbp' },
  accessDifficultyPercentage: { label: 'Access difficulty surcharge', unit: 'percent' },
  margin: { label: 'Margin (profit)', unit: 'gbp' },
  total: { label: 'Total', unit: 'gbp', emphasis: true },
  // Internal aggregates — hidden from the cost sheet.
  controllableCost: { label: 'Controllable cost', unit: 'gbp', hidden: true },
  marginMultiplier: { label: 'Margin multiplier', unit: 'multiplier', hidden: true },
  marginedTotal: { label: 'Total with margin', unit: 'gbp', hidden: true },
  passThroughCost: { label: 'Pass-through cost', unit: 'gbp', hidden: true },
  subtotal: { label: 'Subtotal', unit: 'gbp', hidden: true },
  // An extra-crew headcount, not a cost (its cost is already inside crewCost).
  complicationExtraCrew: { label: 'Extra crew (complications)', unit: 'count', hidden: true },
};

/** Per-extra line keys — their presence suppresses the lumped `extrasCost`. */
const ITEMISED_EXTRA_KEYS = ['packing', 'cleaning', 'storage', 'assembly'] as const;

export interface BreakdownRow {
  key: string;
  label: string;
  display: string;
  emphasis: boolean;
}

/** camelCase / snake_case → "Title case words" for unmapped future keys. */
function humaniseKey(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    case 'multiplier':
      return `×${value.toFixed(2)}`;
    case 'count':
      return String(Math.round(value));
    case 'percent':
      return `${Math.round(value * 100)}%`;
    case 'gbp':
    default:
      return GBP_WHOLE.format(value);
  }
}

/**
 * Turn the stored intake breakdown into an ordered, labelled, correctly-unit'd
 * cost sheet. Known keys render first in declared order, then any unmapped numeric
 * keys in source order. Hidden internal aggregates, the lumped extras total when
 * per-extra lines exist, and zero / non-finite values are all dropped.
 */
export function formatIntakeBreakdown(breakdown: Record<string, unknown>): BreakdownRow[] {
  const hasItemisedExtras = ITEMISED_EXTRA_KEYS.some(
    (k) => typeof breakdown[k] === 'number' && breakdown[k] !== 0,
  );

  const rows: BreakdownRow[] = [];
  const emitted = new Set<string>();

  const emit = (key: string, value: number) => {
    if (!Number.isFinite(value) || value === 0) return;
    const field = FIELDS[key];
    if (field?.hidden) return;
    if (key === 'extrasCost' && hasItemisedExtras) return;
    rows.push({
      key,
      label: field?.label ?? humaniseKey(key),
      display: formatValue(value, field?.unit ?? 'gbp'),
      emphasis: field?.emphasis ?? false,
    });
  };

  for (const key of Object.keys(FIELDS)) {
    const v = breakdown[key];
    if (typeof v === 'number') {
      emit(key, v);
      emitted.add(key);
    }
  }
  for (const [key, v] of Object.entries(breakdown)) {
    if (emitted.has(key) || key in FIELDS) continue;
    if (typeof v === 'number') emit(key, v);
  }

  return rows;
}
