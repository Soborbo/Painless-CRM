# Phase 11 — Customer Sign-off & Review (no gating)

**Status:** Skeleton (v2 — review gating removed)
**Duration estimate:** 2 weeks
**Prerequisite:** Phase 10 (job execution)
**Version:** v0.2 (post-launch)
**Related:** STATE_MACHINE.md `paid` automation, DECISIONS.md ADR-010

---

## Goal

At the end of every job, the customer signs off on the work via the worker's phone. After the job is paid, every customer receives a single message containing both: a Google review link **and** a complaints/feedback link. The customer chooses. We do not filter, gate, or branch based on satisfaction signals.

## Why this phase matters

Reviews are critical to local SEO and lead flow. A 5-star Google review is worth £200+ in future leads. But review gating — the practice of routing high-NPS customers to public review sites and low-NPS customers to private feedback — **violates Google's review policy** and risks the GMB profile being suspended (see [Google's prohibited practices](https://support.google.com/contributionpolicy/answer/7400114)). The compliant pattern is to ask everyone, with a complaints path also visible.

## What changed from v1

The v1 plan had an NPS gate (9–10 → review, 7–8 → feedback, 0–6 → complaint). v2 removes the gate. ADR-010 explains. Net effect:

- Slightly slower review velocity (some unhappy customers will now leave bad reviews)
- Long-term: GMB profile remains in good standing (huge), authentic positive reviews dominate (Painless's quality is strong), complaint flow gives early operational signal

## Deliverables

### 1. End-of-job sign-off form (PWA)

Mobile-signed form completed by the loader-in-charge, in the worker PWA, before clocking out:

- Customer signature (canvas, finger-drawn)
- Final cubic confirmation (matches or differs from estimated)
- Final hours confirmation
- Customer satisfaction quick-rating (1–5 stars, optional, internal use only — never sent anywhere external)
- Photos: any damages or condition issues observed (post-move)
- Notes: any verbal feedback the customer wanted captured
- Customer email confirmation (for review request later)

Stored in `customer_signoffs` (one per job). Triggers job stage transition `in_progress → completed`.

### 2. Internal satisfaction tracking

The 1–5 stars rating is **internal only**. It does not gate review requests, does not surface in customer comms, does not route differently. It is used by:

- Operations dashboard to monitor satisfaction trends per worker, per crew, per van
- Pattern detection: 3+ consecutive low ratings on same worker → manager notification
- Quarterly QA reviews

Workers cannot see other workers' ratings.

### 3. Universal review request flow

When a job transitions to stage `paid`, the automation engine queues a review request email. Cron job sends it 24 hours after `paid` to allow the customer to settle in.

The email is **one** message containing:

- Thank-you message with photo of the work / van branding
- "If you have a moment, we'd love a Google review: [link]"
- "If something didn't go right, please tell us: [link to complaints form]"
- Both links are equally prominent. No button hierarchy.

The Google review link is the standard `https://search.google.com/local/writereview?placeid={place_id}` — Painless's GMB place ID is in `companies.gmb_place_id`.

The complaints link is a tokenized URL pointing to a public-form page (`/feedback/{token}`).

### 4. Follow-up cadence

If no `review_requests.responded_at` is set, send follow-up at +7 days and +14 days. Same content, slightly different copy ("Hope you're settled in! If you've got 30 seconds, a review would mean a lot to us"). After +14 days no further automated follow-ups.

If the customer clicks either link (review or feedback), follow-ups stop immediately. Click tracking via Resend webhooks (Phase 13).

Phase 13 also adds:
- Send via WhatsApp instead of email if customer's preferred channel is WhatsApp (post-v0.2)
- Send via SMS if email bounced (Phase 13)

### 5. Complaints workflow

`/feedback/{token}` is a public form (no login). Customer fills in:

- What went wrong (free text, required)
- Severity self-assessment (minor inconvenience / something needs fixing / major problem)
- Photos (optional)
- Preferred resolution (free text, optional)
- Best contact method + time

On submit: creates a `complaints` row, assigns to operations admin (or company-configured complaints owner), sends Slack/email notification, sets up a 24-hour SLA for first response.

Complaints have their own state machine:
- `open` → `acknowledged` (admin replied) → `investigating` → `resolved`
- `escalated` (when not resolved within 7 days, surfaced to manager)

Complaint resolution stats feed Phase 14 reporting.

### 6. Damages module

Damages are tracked separately from complaints. A complaint may or may not include a damages claim; a damages claim may or may not arise from a complaint.

`damage_claims` table:
- Reference to job
- Customer description + photos
- Worker description (if discovered post-move)
- Claim status: `reported`, `under_review`, `accepted`, `disputed`, `resolved`, `rejected`
- Payout amount (if any)
- Insurance claim reference (if escalated to insurer)
- Resolution notes

UI: `/jobs/{id}/damages` tab in the job detail page. Admin-only edit; sales/manager read-only.

Repeat-claim pattern detection: when a customer has 2+ damage claims across separate jobs, flag in the customer 360 view (Phase 16).

### 7. Stats per worker

In `/reports/team`:

- Reviews per worker (jobs they were lead on, where customer left a Google review)
- Complaints per worker
- Damages per worker
- Average internal satisfaction rating (1–5 stars from sign-off)

Used for performance reviews and bonus calculations. Workers don't see each other's stats.

## Schema additions

See `references/schema.sql` sections H (Sign-off & Reviews) and the existing `complaints`, `damage_claims`, `review_requests`, `customer_signoffs` tables. v2 changes:

- `review_requests` no longer has `nps_score` or `gating_decision` columns (gating removed)
- New column `review_requests.complaints_link_clicked_at timestamptz` for tracking
- New column `customer_signoffs.internal_rating_1_5 int` (1–5, optional)
- `complaints.severity_self_assessed text check (severity_self_assessed in ('minor','needs_fix','major'))`

## Pages

- `/jobs/{id}/signoff` — sign-off form (PWA)
- `/jobs/{id}/complaints` — complaints list per job (admin)
- `/jobs/{id}/damages` — damages claims per job (admin)
- `/feedback/{token}` — public complaints form (no auth)
- `/complaints` — admin complaints kanban
- `/damages` — admin damages list
- `/reports/team` — per-worker stats (Phase 14)

## Acceptance criteria

1. Worker PWA can complete a sign-off form including signature
2. Job transitions `in_progress → completed` on sign-off submit (per STATE_MACHINE.md)
3. Job stage transition to `paid` enqueues a review request 24h later
4. Review request email contains both Google review link AND complaints link, equally prominent
5. Click on review link or complaints link stops further follow-ups
6. Follow-ups send at +7d and +14d if no click
7. Public complaints form accepts submissions without login (rate-limited per IP)
8. Complaint creates ticket with 24h SLA, notifies admin
9. Damages claim creation, status updates, photo upload all functional
10. Per-worker stats page shows correct counts
11. Compliance check: no automated branching by NPS/satisfaction signals (verified by reading the code, not just behavior)

## Out of scope (post-v0.2)

- WhatsApp/SMS review requests (Phase 13)
- Photo OCR for damage claims
- Automated insurance claim filing
- Customer self-service damage claim portal
- Trustpilot / other review sites (Google only for now)

## Anti-patterns to avoid

- **Don't** add NPS gating "lite" (e.g., "if 0–6 we just won't follow up"). That's still gating.
- **Don't** filter who gets the review email by past job complaints. Every paid customer gets the same email.
- **Don't** put the complaints link in smaller text than the review link. Equal prominence.
- **Don't** ask the customer for a review *before* the job is paid. Reviews based on incomplete experience are weaker and feel transactional.
