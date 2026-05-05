import type { PricingConfig } from '@/lib/schemas/pricing';

// Smoke fixture mirroring the painlessremovals v4.2 default shape, with
// indicative numbers. The full 17 Jay-validated fixtures land alongside the
// painlessremovals integration in a follow-up; this single fixture exists so
// the engine has a deterministic test bed and the admin UI has a sane preview.

export const SMOKE_PRICING_CONFIG: PricingConfig = {
  version_label: 'smoke-v0',
  margin_matrix: [
    [0.18, 0.22, 0.26],
    [0.2, 0.24, 0.28],
    [0.22, 0.26, 0.3],
    [0.24, 0.28, 0.32],
    [0.26, 0.3, 0.34],
  ],
  crew_hourly_rate_pence: 2400,
  van_hourly_rate_pence: 1200,
  pass_through_config: {
    fuel_per_mile_pence: 40,
    insurance_per_job_pence: 1500,
    waste_disposal_fixed_pence: null,
  },
  complications: [
    { code: 'narrow_access', label: 'Narrow access', points: 2 },
    { code: 'long_carry', label: 'Long carry', points: 2 },
    { code: 'no_lift_3plus', label: '3+ floors no lift', points: 3 },
    { code: 'piano', label: 'Piano', points: 4 },
    { code: 'safe', label: 'Heavy safe', points: 4 },
  ],
  size_categories: [
    {
      code: 'studio',
      label: 'Studio',
      cubic_ft_min: 0,
      cubic_ft_max: 250,
      crew_size: 2,
      estimated_hours: 3,
    },
    {
      code: 'one_bed',
      label: '1 bedroom',
      cubic_ft_min: 250,
      cubic_ft_max: 500,
      crew_size: 2,
      estimated_hours: 4,
    },
    {
      code: 'two_bed',
      label: '2 bedroom',
      cubic_ft_min: 500,
      cubic_ft_max: 800,
      crew_size: 3,
      estimated_hours: 5,
    },
    {
      code: 'three_bed',
      label: '3 bedroom',
      cubic_ft_min: 800,
      cubic_ft_max: 1200,
      crew_size: 3,
      estimated_hours: 7,
    },
    {
      code: 'four_plus',
      label: '4+ bedroom',
      cubic_ft_min: 1200,
      cubic_ft_max: 4000,
      crew_size: 4,
      estimated_hours: 9,
    },
  ],
  distance_bands: [
    { code: 'local', miles_min: 0, miles_max: 25 },
    { code: 'regional', miles_min: 25, miles_max: 75 },
    { code: 'long', miles_min: 75, miles_max: 2000 },
  ],
  dynamic_pricing_enabled: false,
  capacity_bands: [
    { band: 'green', max_utilization: 0.6, margin_delta: -0.05 },
    { band: 'yellow', max_utilization: 0.85, margin_delta: 0 },
    { band: 'red', max_utilization: 1, margin_delta: 0.1 },
  ],
  modulation_sources: ['calculator', 'public_availability'],
  quote_validity_days: 7,
  notes: 'Smoke fixture — replace with Jay-signed v4.2 numbers before go-live.',
};
