-- Full-fidelity quote intake (website calculator → CRM).
--
-- The painlessremovals calculator collects ~40 fields per quote, but only
-- name/email/phone/postcode + a 4-field quote summary historically reached the
-- CRM. The webhook contract now carries the full submission (addresses, move
-- date, resources, extras, consent, attribution, line-item breakdown). Most of
-- it lands in existing columns (jobs.move_date / service_type / estimated_*,
-- job_addresses + addresses); the remainder — every entered item without a
-- dedicated column — is stored losslessly here.
--
-- One additive change, no drops:
--
--  1. jobs.intake_details — jsonb map of the residual intake payload
--     (service sizes/slider, men/vans/manual-override, flags, consent,
--     breakdown, extras, attribution). Populated by ingestQuote's
--     buildIntakeDetails(); default '{}' so every existing row reads cleanly.
--
-- The full raw webhook body is also retained verbatim in webhook_events.payload
-- (dedup/audit), so this column is the *queryable* projection, not the system
-- of record for the raw event.

alter table jobs add column if not exists intake_details jsonb not null default '{}';

comment on column jobs.intake_details is
  'Lossless map of quote-intake items with no dedicated column (service sizes, resources, flags, consent, price breakdown, extras, attribution). Set by the quote webhook ingestor.';
