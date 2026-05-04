import { SMOKE_PRICING_CONFIG } from '@/lib/pricing/fixtures';
import { applyScalarEdit, parseScalarEditForm } from '@/lib/pricing/form';
import type { PricingScalarEditInput } from '@/lib/schemas/pricing';
import { describe, expect, it } from 'vitest';

function buildForm(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

const baseEntries: Array<[string, string]> = [
  ['version_label', 'v0.2'],
  ['crew_hourly_rate_pence', '2500'],
  ['van_hourly_rate_pence', '1300'],
  ['fuel_per_mile_pence', '45'],
  ['insurance_per_job_pence', '1600'],
  ['quote_validity_days', '14'],
];

describe('parseScalarEditForm', () => {
  it('coerces a fully-populated form into a scalar edit', () => {
    const result = parseScalarEditForm(buildForm(baseEntries));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.version_label).toBe('v0.2');
      expect(result.input.crew_hourly_rate_pence).toBe(2500);
      expect(result.input.van_hourly_rate_pence).toBe(1300);
      expect(result.input.fuel_per_mile_pence).toBe(45);
      expect(result.input.insurance_per_job_pence).toBe(1600);
      expect(result.input.waste_disposal_fixed_pence).toBeNull();
      expect(result.input.quote_validity_days).toBe(14);
      expect(result.input.dynamic_pricing_enabled).toBe(false);
    }
  });

  it('reads dynamic_pricing_enabled from a checkbox', () => {
    const result = parseScalarEditForm(
      buildForm([...baseEntries, ['dynamic_pricing_enabled', 'on']]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.dynamic_pricing_enabled).toBe(true);
  });

  it('keeps waste_disposal_fixed_pence as null when blank', () => {
    const result = parseScalarEditForm(
      buildForm([...baseEntries, ['waste_disposal_fixed_pence', '']]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.waste_disposal_fixed_pence).toBeNull();
  });

  it('captures waste_disposal_fixed_pence when a number is provided', () => {
    const result = parseScalarEditForm(
      buildForm([...baseEntries, ['waste_disposal_fixed_pence', '1200']]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.waste_disposal_fixed_pence).toBe(1200);
  });

  it('rejects negative hourly rates', () => {
    const result = parseScalarEditForm(
      buildForm([
        ['version_label', 'v0.2'],
        ['crew_hourly_rate_pence', '-1'],
        ['van_hourly_rate_pence', '1300'],
        ['fuel_per_mile_pence', '45'],
        ['insurance_per_job_pence', '1600'],
        ['quote_validity_days', '14'],
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects empty version_label', () => {
    const result = parseScalarEditForm(
      buildForm([
        ['version_label', ''],
        ['crew_hourly_rate_pence', '2500'],
        ['van_hourly_rate_pence', '1300'],
        ['fuel_per_mile_pence', '45'],
        ['insurance_per_job_pence', '1600'],
        ['quote_validity_days', '14'],
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects validity outside [1, 365]', () => {
    const result = parseScalarEditForm(
      buildForm([
        ['version_label', 'v0.2'],
        ['crew_hourly_rate_pence', '2500'],
        ['van_hourly_rate_pence', '1300'],
        ['fuel_per_mile_pence', '45'],
        ['insurance_per_job_pence', '1600'],
        ['quote_validity_days', '0'],
      ]),
    );
    expect(result.ok).toBe(false);
  });
});

describe('applyScalarEdit', () => {
  const edit: PricingScalarEditInput = {
    version_label: 'v0.2',
    crew_hourly_rate_pence: 2500,
    van_hourly_rate_pence: 1300,
    fuel_per_mile_pence: 45,
    insurance_per_job_pence: 1600,
    waste_disposal_fixed_pence: 1200,
    quote_validity_days: 14,
    dynamic_pricing_enabled: true,
    notes: 'rate review',
  };

  it('overwrites scalars while keeping the matrix and collections', () => {
    const merged = applyScalarEdit(SMOKE_PRICING_CONFIG, edit);
    expect(merged.version_label).toBe('v0.2');
    expect(merged.crew_hourly_rate_pence).toBe(2500);
    expect(merged.van_hourly_rate_pence).toBe(1300);
    expect(merged.pass_through_config.fuel_per_mile_pence).toBe(45);
    expect(merged.pass_through_config.waste_disposal_fixed_pence).toBe(1200);
    expect(merged.quote_validity_days).toBe(14);
    expect(merged.dynamic_pricing_enabled).toBe(true);
    expect(merged.notes).toBe('rate review');

    expect(merged.margin_matrix).toEqual(SMOKE_PRICING_CONFIG.margin_matrix);
    expect(merged.size_categories).toEqual(SMOKE_PRICING_CONFIG.size_categories);
    expect(merged.complications).toEqual(SMOKE_PRICING_CONFIG.complications);
    expect(merged.distance_bands).toEqual(SMOKE_PRICING_CONFIG.distance_bands);
    expect(merged.capacity_bands).toEqual(SMOKE_PRICING_CONFIG.capacity_bands);
    expect(merged.modulation_sources).toEqual(SMOKE_PRICING_CONFIG.modulation_sources);
  });

  it('falls back to base notes when the edit notes are null', () => {
    const merged = applyScalarEdit(SMOKE_PRICING_CONFIG, { ...edit, notes: null });
    expect(merged.notes).toBe(SMOKE_PRICING_CONFIG.notes);
  });
});
