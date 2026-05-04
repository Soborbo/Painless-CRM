import {
  type PricingConfig,
  type PricingScalarEditInput,
  PricingScalarEditSchema,
  type QuoteInput,
  QuoteInputSchema,
} from '@/lib/schemas/pricing';

// Pure FormData → QuoteInput coercion. Lives outside the 'use server' module
// so it can be unit-tested without spinning up an action server.

export function parseSimulationForm(
  form: FormData,
): { ok: true; input: QuoteInput } | { ok: false; message: string } {
  const complications = form.getAll('complications').flatMap((v) =>
    typeof v === 'string'
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  const source = form.get('source');
  const parsed = QuoteInputSchema.safeParse({
    size_code: form.get('size_code'),
    distance_miles: Number(form.get('distance_miles')),
    complications,
    source: typeof source === 'string' && source.length > 0 ? source : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  return { ok: true, input: parsed.data };
}

function pickInt(form: FormData, name: string): number {
  const raw = form.get(name);
  if (typeof raw !== 'string' || raw.trim().length === 0) return Number.NaN;
  return Number(raw);
}

function pickOptionalInt(form: FormData, name: string): number | null {
  const raw = form.get(name);
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  return Number(raw);
}

export function parseScalarEditForm(
  form: FormData,
): { ok: true; input: PricingScalarEditInput } | { ok: false; message: string } {
  const notes = form.get('notes');
  const parsed = PricingScalarEditSchema.safeParse({
    version_label: form.get('version_label'),
    crew_hourly_rate_pence: pickInt(form, 'crew_hourly_rate_pence'),
    van_hourly_rate_pence: pickInt(form, 'van_hourly_rate_pence'),
    fuel_per_mile_pence: pickInt(form, 'fuel_per_mile_pence'),
    insurance_per_job_pence: pickInt(form, 'insurance_per_job_pence'),
    waste_disposal_fixed_pence: pickOptionalInt(form, 'waste_disposal_fixed_pence'),
    quote_validity_days: pickInt(form, 'quote_validity_days'),
    dynamic_pricing_enabled: form.get('dynamic_pricing_enabled') === 'on',
    notes: typeof notes === 'string' && notes.length > 0 ? notes : null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  return { ok: true, input: parsed.data };
}

export function applyScalarEdit(base: PricingConfig, edit: PricingScalarEditInput): PricingConfig {
  return {
    ...base,
    version_label: edit.version_label,
    crew_hourly_rate_pence: edit.crew_hourly_rate_pence,
    van_hourly_rate_pence: edit.van_hourly_rate_pence,
    pass_through_config: {
      fuel_per_mile_pence: edit.fuel_per_mile_pence,
      insurance_per_job_pence: edit.insurance_per_job_pence,
      waste_disposal_fixed_pence: edit.waste_disposal_fixed_pence,
    },
    quote_validity_days: edit.quote_validity_days,
    dynamic_pricing_enabled: edit.dynamic_pricing_enabled,
    notes: edit.notes ?? base.notes ?? null,
  };
}
