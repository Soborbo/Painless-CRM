# iMVE → painless-crm legacy import (Phase 17)

One-off importer used to load Jay's first real iMVE export into the live tenant,
replacing the seed/test data. Implements the mapping in
`painless-crm-spec/MIGRATION_MAPPING.md §3` and is recorded as **ADR-040**.

## What it imports

Four CSV exports (kept **out of git** — they contain customer PII):

| Export | → CRM |
|---|---|
| jobs export (`jobs_*.csv`) | `customers` (deduped), `addresses` (postcode-only), `jobs`, `job_addresses` |
| deposit / job / custom invoice exports | `invoices` + `invoice_lines` |
| any "Paid" invoice | `payments` + `payment_allocations` |

The jobs export is denormalised (one row per job×invoice); jobs are collapsed to
one row per job number. Invoices come from the detailed exports where available,
and are rebuilt from the jobs-export summary columns for the ~500 invoices that
only appear there, so nothing is dropped.

## Mapping decisions

- **Status → stage:** iMVE's ~35 statuses map to the 13 canonical `job_stage`
  values. The **exact original status is preserved verbatim in `jobs.sub_status`**;
  `jobs.decline_reason` is set for the `Declined – …` variants. See the `STAGE` /
  `DREASON` tables in `generate_staging.py`.
- **No-home iMVE fields** (migration 56 adds columns — ADR-040):
  `jobs.move_end_date` (multi-day moves), `jobs.legacy_name` (iMVE "Job Name").
- **Postcodes** become `addresses` rows (`line1 = postcode`, `city = 'Unknown'`),
  deduped case-insensitively, linked through `job_addresses` (from/to).
- **Skipped:** ~9 obvious test rows in the export (`Spam Test`, `John Test`,
  status `Test`, `API test`, staff `Jay Newton`, etc.).
- Every imported row carries `legacy_imported = true`.

## Running it

```bash
# 1. Generate chunked staging INSERTs from the CSVs (no DB writes)
python scripts/imve_import/generate_staging.py     # reads /tmp/import/*.csv

# 2. Create the stg.* tables, load the chunks, then:
psql < scripts/imve_import/transform.sql           # build the real CRM rows
drop schema stg cascade;                           # tidy up
```

Integrity was verified by comparing row counts + numeric sums + md5 of the text
fields between the CSVs, the staging tables, and the final tables (all exact).

## Rollback

```bash
psql < scripts/imve_import/rollback.sql            # deletes WHERE legacy_imported
```

Removes only the flagged rows; anything created in the app afterwards is untouched.
