# Phase 06 — Quote Builder & Acceptance

**Status**: Skeleton (expand when Phase 5 ships)
**Duration estimate**: 3 weeks
**Prerequisite**: Phase 05 complete

---

## Goal

Sales reps create quotes manually inside the CRM (for phone enquiries), customers accept quotes via mobile-friendly link, accepted quotes auto-transition jobs to `accepted` stage. The calculator-generated quotes from Phase 5 reuse the same data path.

## Deliverables

1. Manual quote builder: pick customer, pick size, pick complications, see live breakdown
2. Quote PDF generator (Phase 0 smoke test 1 validated this works on Cloudflare)
3. Send quote via email with unique acceptance link (token-based)
4. Public acceptance page (no login): customer reviews quote, e-signs
5. Quote acceptance Server Action: validate token, mark accepted, trigger automation
6. Quote revision flow (re-issue without losing history)
7. Quote expiry handling (auto-mark expired after `valid_until`)
8. Quote variants (pickup-only, full-service, premium) presented in same email

## Key decisions

- **DECISION**: Single-quote-per-job vs multiple-variants-per-quote — recommendation: variants in single email (better conversion), one accepted variant marks job as `accepted`
- **DECISION**: E-signature legal weight — UK Electronic Communications Act allows simple click-to-accept with audit trail; no DocuSign needed for v1

## Schema additions

```sql
create table quote_variants (
  id uuid primary key,
  company_id uuid not null,
  quote_id uuid not null references quotes(id),
  variant_label text not null,  -- 'Standard', 'Premium', 'Pickup Only'
  total_pence int not null,
  description text,
  display_order int default 0
);

create table quote_acceptances (
  id uuid primary key,
  company_id uuid not null,
  quote_id uuid not null references quotes(id),
  variant_id uuid references quote_variants(id),
  customer_id uuid not null references customers(id),
  accepted_at timestamptz not null default now(),
  ip_address inet not null,
  user_agent text,
  signature_image_url text,  -- canvas-drawn signature, optional
  acceptance_token text not null,  -- the URL token, audit trail
  consents jsonb,  -- e.g., terms_v1.2 accepted
  notes text
);
```

## Key files

```
src/app/dashboard/jobs/[id]/quote/{new,edit,send}/page.tsx
src/app/quote/[token]/page.tsx  (public acceptance page)
src/lib/actions/quotes.ts
src/lib/integrations/pdf/generate-quote.ts  (Cloudflare Browser Rendering)
```

## Out of scope

- Customer-facing portal with quote history (post-1.0)
- Quote bundling for multi-customer corporate accounts (post-1.0)

## Acceptance criteria (high-level)

- [ ] Manual quote builder lets rep build full quote in <2 minutes
- [ ] Quote PDF generated and emailed with branded design
- [ ] Customer can accept on mobile in <30 seconds
- [ ] Acceptance auto-transitions job to `accepted` stage
- [ ] Expired quotes show "Quote expired, contact us" page
- [ ] Activity log captures send + open + accept events
