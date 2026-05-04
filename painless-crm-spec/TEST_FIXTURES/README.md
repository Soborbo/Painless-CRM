# Test Fixtures

Reference fixtures for CI tests across painless-crm and painlessremovals.com.

## Files

### `jay-v42-pricing-scenarios.json`

The 17 hand-validated pricing scenarios. **Important:** the values in this file are **structural placeholders**. The real expected totals must be filled in by Laszlo from the actual Jay-validated v4.2 reference data. The schema (input fields, scenario IDs, structure) is correct and matches the v4.2 engine contract.

Used by:
- `tests/pricing/scenarios.test.ts` in painless-crm
- `tests/pricing/scenarios.test.ts` in painlessremovals.com calculator
- Both run on every PR; both must pass

Tolerance: ±15% deviation from `expected_total_pence`. Average deviation in v4.2 = 10.6%.

When pricing changes (new pricing version published):
1. Run scenarios test
2. If any deviate >15%, **stop**, do not publish
3. Either: revise the change, or update the fixtures (with sign-off from Jay)
4. Document the deviation in `pricing_versions.migration_notes`

### `webhook-fixtures.json` (TODO)

Sample valid + invalid webhook payloads for testing the v2 hardened handler. Covers all five gates (signature, timestamp, version, idempotency, rate limit) with positive and negative cases per gate.

To be filled in alongside Phase 5 implementation.

---

## Schema

`jay-v42-pricing-scenarios.json` follows this shape:

```typescript
interface ScenariosFixture {
  $schema: string;
  version: string;             // e.g., "v4.2"
  tolerance_pct: number;       // 15
  description: string;
  fixtures: Array<{
    id: string;                // stable ID, e.g., "jay-001-bristol-1bed-local"
    description: string;
    input: PricingEngineInput; // shape matches lib/pricing/types.ts
    expected_total_pence: number | null;  // null = expected to require survey
    expected_requires_survey?: boolean;
    expected_breakdown?: {     // optional, for hourly-rate validation
      crew_hours: number;
      crew_rate_pence_per_hour_with_margin: number;
      van_charge_pence: number;
      passthrough_costs_pence: number;
    };
    notes: string;             // human context
  }>;
}
```

## Usage

```typescript
import scenarios from '@/test-fixtures/jay-v42-pricing-scenarios.json';
import { calculateQuote } from '@/lib/pricing/engine';

describe('v4.2 pricing scenarios', () => {
  scenarios.fixtures.forEach((scenario) => {
    it(scenario.id, () => {
      const result = calculateQuote(scenario.input);

      if (scenario.expected_requires_survey) {
        expect(result.requires_survey).toBe(true);
        return;
      }

      const tolerance = scenario.expected_total_pence * (scenarios.tolerance_pct / 100);
      const deviation = Math.abs(result.total_pence - scenario.expected_total_pence);
      expect(deviation).toBeLessThanOrEqual(tolerance);
    });
  });
});
```
