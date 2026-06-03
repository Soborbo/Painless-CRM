# Transactional Email Templates — iMVE source catalogue

> **Source:** Jay's live iMVE transactional-email templates (Painless Removals Ltd), exported 2026-06-03.
> **Purpose:** single source of truth for the email copy migrating into painless-crm
> (`email_templates` table + Comms Hub automation flow). Feeds Phase 17.
>
> **Placeholder syntax note.** iMVE writes merge fields as `%field%`. painless-crm renders
> `{{field}}` (see `src/lib/comms/render.ts`). Every body below is shown in the **canonical
> `{{…}}` form**; the original `%…%` token it came from is in §1. Do **not** paste `%…%` into
> the app — it will be sent to the customer literally.

---

## 1. Reserved-word (merge variable) map

| iMVE token | Canonical painless-crm token | Source | Exposed to automation engine today? |
|---|---|---|---|
| `%first_name%` | `{{first_name}}` | `customers.first_name` | ❌ (only full `customer_name` is) |
| `%last_name%` | `{{last_name}}` | `customers.last_name` | ❌ |
| `%company_name%` | `{{company_name}}` | **Sender** company = "Painless Removals Ltd" (settings) | ❌ — note: today's `customer_name` uses the *customer's* company, not the sender's |
| `%job_no%` | `{{job_number}}` | `jobs.job_number` | ✅ (renamed: was `job_no`) |
| `%move_date%` | `{{move_date}}` | `jobs.move_date` | ✅ |
| `%move_time%` | `{{move_time}}` | `jobs.move_time` (crew arrival window) | ❌ |
| `%booked_date%` | `{{booked_date}}` | survey/home-visit date | ❌ |
| `%booked_time%` | `{{booked_time}}` | survey/home-visit time | ❌ |
| `%current_address%` | `{{current_address}}` | job "moving from" address | ❌ |
| `%new_address%` | `{{new_address}}` | job "moving to" address | ❌ |

**Gap:** the automation send step (`src/lib/comms/automation-cron.ts → buildVars`) currently only
exposes `job_number, move_date, from_stage, to_stage, customer_name`. Wiring these templates into
the flow requires extending that vocabulary — see §4.

---

## 2. Templates

Each entry: **Name** · subject · canonical body · variables used · proposed flow trigger.
Triggers reference the job stage machine (`STATE_MACHINE.md`): the engine fires on
`job.stage_changed` with optional `to`/`from` filters and a delay.

### 2.1 Welcome email
- **Subject:** `Let's make your removal Painless!`
- **Variables:** `first_name`, `company_name`
- **Proposed trigger:** new enquiry (job enters `lead`) — ⚠️ see §4-A (no transition *into* `lead`).

```
Dear {{first_name}},

Thanks for reaching out to us about your move—let's get the ball rolling!

Not done an instant quote yet?
No worries—it only takes 47 seconds (seriously, we timed it). Pop over to: painlessremovals.com/instantquote

Already got your instant quote?
Awesome! The quickest way to get your official quote is by doing our self-survey video tour. Simply head to: painlessremovals.com/self-survey

There you'll find all the info you need and can upload a video walk-through of your home at your convenience.

If uploading a video feels like a bit too much, don't worry—our team will give you a ring soon to help in any way we can or to book a home visit.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
hello@painlessremovals.com
```

### 2.2 Survey request (3 options: video self-survey / video call / home visit)
- **Subject:** `Survey request {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** job → `contacted` (offer survey). ⚠️ overlaps with 2.3.

```
Hi {{first_name}},

Thanks for taking a look at our pricing calculator — I hope it's been helpful in giving you a rough idea of costs.

Just so you know, the figures from the calculator are based on averages, so they can sometimes come out slightly high or low depending on the exact details of your move.

When you're ready to take things a step further, the next step is a quick survey so we can confirm the volume and provide a fixed, accurate quote.

You've got three easy options:

Video Self-Survey
Film a short walkthrough in your own time (usually 5–10 minutes): painlessremovals.com/self-survey

Video Call Survey
A live video call with one of our team (usually 10–15 minutes), where we guide you through the process and ask any questions as we go.

Home Visit
If you're local to Bristol, we can arrange a visit — usually around 30 minutes. Ideal for larger or more complex moves.

There's absolutely no pressure — whether you're just exploring options or ready to book, feel free to reply to this email or give us a call if you'd like to arrange a survey or chat things through.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.3 Survey request – video (2 options: video self-survey / video call)
- **Subject:** `Survey request {{job_number}}`
- **Variables:** `first_name`, `job_number` (signed "Tom Mallett", company hard-coded "Painless Removals Ltd")
- **Proposed trigger:** variant of 2.2 (no home-visit option). ⚠️ see §4-D: which one is the default?

```
Hi {{first_name}},

Thanks for taking a look at our pricing calculator — I hope it's been helpful in giving you a rough idea of costs.

Just so you know, the figures from the calculator are based on averages, so they can sometimes come out slightly high or low depending on the exact details of your move.

When you're ready to take things a step further, the next step is a quick survey so we can confirm the volume and provide a fixed, accurate quote.

You've got two easy options:

Video Self-Survey
Film a short walkthrough in your own time (usually 5–10 minutes): painlessremovals.com/self-survey

Video Call Survey
A live video call with one of our team (usually 10–15 minutes), where we guide you through the process and ask any questions as we go.

There's absolutely no pressure — whether you're just exploring options or ready to book, feel free to reply to this email or give us a call if you'd like to arrange a survey or chat things through.

Warm regards,
Tom Mallett
Painless Removals Ltd
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.4 Photos & List Required
- **Subject:** `Photos & List Required {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`, `current_address`, `new_address`
- **Proposed trigger:** manual send (ad-hoc quoting path). ⚠️ no auto trigger.

```
Dear {{first_name}},

Thank you for contacting {{company_name}} regarding your upcoming move.

Moving from..
{{current_address}}

Moving to…
{{new_address}}

Please send a list/photos to this email address, and we will quote you immediately.

Please do not hesitate to contact us if you require any further information.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.5 Survey Confirmation
- **Subject:** `Confirmation survey {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`, `booked_date`, `booked_time`, `current_address`, `new_address`
- **Proposed trigger:** job → `survey_scheduled`.

```
Dear {{first_name}},

Thank you for contacting {{company_name}} regarding your upcoming move. We have booked your home visit for {{booked_date}} at {{booked_time}}

Moving from
{{current_address}}

Moving to
{{new_address}}

Please do not hesitate to contact us if you require any further information.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.6 Quotation
- **Subject:** `Painless Removals quote {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** job → `quoted`.

```
Hi {{first_name}},

Thanks for getting in touch about your move! We've put together a fully tailored quote for you—attached to this email.

You can accept or decline it easily by clicking the link in the attachment. If you accept, we'll give you a call to go over the details and get everything booked in.

If you choose Painless Removals, you'll have complete peace of mind. We're fully insured, and when we book your move, that day is dedicated to you—no other jobs. You'll have our full attention, and if anything comes up on the day, we'll be there to handle it. That's how we keep things quick, efficient, safe—and painless.

Please review our terms and conditions before accepting the quote.
Any questions? Just give us a ring or drop us an email—we're happy to help.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.7 Waste Clearance quote
- **Subject:** `Your waste clearance quote {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** job → `quoted` **for waste-clearance jobs only**. ⚠️ see §4-E (job-type filter).

```
Dear {{first_name}},

Thanks for getting in touch about your clearance! We've put together a tailored quote for you—attached to this email.

You can accept or decline it easily by clicking the link in the attachment. If you accept, we'll give you a call to go over the details and get everything booked in.

At Painless Removals, we're committed to doing things properly. That means clearing your items quickly and efficiently—but also ethically. We recycle or reuse as much as possible, only taking items to the tip as a last resort. It's our way of doing our part for the planet while giving you a reliable, stress-free service.

If you have any questions about the quote or what we can and can't take, just give us a ring or drop us an email—we're always happy to help.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com
```

### 2.8 Follow up after quotation
- **Subject:** `Follow up after quotation {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** ⏱️ N days after `quoted` with no response → `sub_status: followup_sent_1`. ⚠️ see §4-B (no-response timer, not a stage change).

```
Dear {{first_name}},

I hope you're well. We recently sent you a quote for your upcoming move, but haven't heard back yet. Is there anything else we can help with? Would you like me to check availability for you?

If you need to update any details or have any questions, feel free to give us a call on 0117 2870082 or reply to this email.

We're here if you need us and hope to hear from you soon.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.9 Yet to hear from you
- **Subject:** `Painless Removals {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** ⏱️ follow-up #2 after `quoted` → `sub_status: followup_sent_2`. ⚠️ §4-B.

```
Hi {{first_name}},

Thanks for your earlier inquiry. We have yet to hear back from you regarding your interest in booking our services. Our diary for the next few weeks is filling up, and if you'd like to reserve your move with us, we'd recommend booking your date sooner rather than later.

If you have any further questions about your move, don't hesitate to contact us.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.10 Last contact
- **Subject:** `Last chance to make your removal Painless`
- **Variables:** `first_name`, `company_name`
- **Proposed trigger:** ⏱️ final follow-up after `quoted`, no response. ⚠️ §4-B.

```
Hi {{first_name}},

I just wanted to check in and see how things are going with your move.

We sent over your estimate recently, but completely understand you may still be in the early stages or just exploring options.

If you'd like to talk through your quote, ask any questions, or arrange a quick survey, we'd be very happy to help — just reply to this email or give us a call on 0117 2870082.

If now's not the right time, no problem at all — we won't keep chasing, but we're here whenever you need us.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.11 Goodbye
- **Subject:** `Still Here If You Need Us`
- **Variables:** `first_name`, `company_name`
- **Proposed trigger:** job → `dead` (lost — no response). Asks for "why not" feedback.

```
Dear {{first_name}},

We hope you're doing well. We sent over a quote for your move a little while ago and haven't heard back. Just wanted to let you know we're still here if you need us.

If you've already made other arrangements, no problem at all—but if you have a moment, we'd really appreciate any feedback on why you decided not to go ahead with us. It helps us improve and provide a better service for future customers.

If you do still need help with your move or have any questions, feel free to reach out—we're happy to assist.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com
```

### 2.12 Thank You for Accepting
- **Subject:** `Thank You for Accepting {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** job → `accepted`. ⚠️ overlaps with 2.13.

```
Hi {{first_name}},

I hope you're well, and thank you for accepting the quote! Have you confirmed your move date yet? If not, would you like us to hold a date provisionally for you?

We're happy to reserve a slot to give you some peace of mind while final plans are being made.

Just let us know what works best for you.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.13 Moving Date
- **Subject:** `Moving Date {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** job → `accepted` (request a confirmed date). ⚠️ overlaps with 2.12.

```
Dear {{first_name}},

Thanks for accepting our quote. Do you have a confirmed date for your move? Or is there a date you would like us to hold provisionally?

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com
```

### 2.14 Invoice for deposit
- **Subject:** `Invoice for deposit {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number` · **attachment:** deposit invoice PDF
- **Proposed trigger:** deposit invoice auto-created (Phase 12). ⚠️ §4-C (invoice/payment event, not a stage change).

```
Hi {{first_name}},

Thank you for choosing {{company_name}} to conduct your move. I have attached the invoice for your deposit.
If you have any questions, please don't hesitate to get in touch.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.15 Deposit Receipt
- **Subject:** `Deposit Receipt {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number` · **attachment:** receipt
- **Proposed trigger:** deposit payment recorded. ⚠️ §4-C (payment event). _(Appeared twice in source — deduplicated.)_

```
Dear {{first_name}},

We have received the deposit for your removal. Thank you for making the payment. Please find the receipt attached.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.16 Removal confirmation
- **Subject:** `Removal confirmation {{job_number}}`
- **Variables:** `first_name`, `last_name`, `company_name`, `job_number`, `move_date`, `move_time`, `current_address`, `new_address`
- **Proposed trigger:** job → `confirmed`.

```
Hi {{first_name}} {{last_name}}

Thank you for confirming your move with {{company_name}}. Your move is booked for {{move_date}}, our team will aim to be with you for {{move_time}}.

Moving from..
{{current_address}}

Moving to…
{{new_address}}

Please feel free to contact us to discuss anything further. If we do not hear from you, we look forward to seeing you on move day.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.17 Move Invoice
- **Subject:** `Move Invoice {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number` · **attachment:** final invoice PDF
- **Proposed trigger:** job → `invoiced`. _(Appeared twice in source — deduplicated.)_

```
Hi {{first_name}},

Your removal invoice is attached. Our bank details are on the invoice. Please feel free to contact the office if you wish to discuss this further.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.18 Move Receipt
- **Subject:** `Move Receipt {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number` · **attachment:** receipt
- **Proposed trigger:** final payment recorded (job → `paid`). ⚠️ §4-C (payment event).

```
Hi {{first_name}},

Thank you, we have received payment for your removal. Please find the receipt attached.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com
```

### 2.19 Storage (storage invoice)
- **Subject:** `Storage Invoice`
- **Variables:** `first_name` (free-text "(start date)" / "(end date)" — **not** merge fields today) · **attachment:** storage invoice PDF
- **Proposed trigger:** storage billing cycle. ⚠️ §4-F (storage_rentals, not job stage; needs `storage_period_start/end` vars).

```
Dear {{first_name}},

Thank you for storing your belongings with Painless Removals LTD.

Please find attached the invoice for storage fee for the period of (start date) to (end date).

If you have any questions about your storage or wish to make changes, please don't hesitate to get in touch.

Kind Regards
Jay Newton
PAINLESS REMOVALS LTD
0117 2870082
painlessremovals.com
jay@painlessremovals.com
```

### 2.20 Please can we get a review?
- **Subject:** `Please can we get a review? {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** ⚠️ §4-G — painless-crm **already has a review-request system** (Phase 11, with its own cron + Google/Trustpilot links). This template likely should not be re-wired as a separate automation rule.

```
Dear {{first_name}},

We hope you're settling in well to your new home, and thanks again for choosing Painless Removals!

As a small, independent business, we rely heavily on word of mouth and positive reviews. If you were happy with our service, we'd be incredibly grateful if you could take a moment to leave us a review:
Google: Leave a review
Trustpilot: Leave a review

Your feedback means a lot and helps others find a moving company they can trust.

Thanks again, and all the best in your new place!

Kind Regards
Jay Newton
{{company_name}}
jay@painlessremovals.com
```

### 2.21 Bank email template (blank scaffold)
- **Subject:** `Edit subject to suit {{job_number}}`
- **Variables:** `first_name`, `company_name`, `job_number`
- **Proposed trigger:** manual send only (blank body scaffold). ⚠️ no auto trigger.

```
Dear {{first_name}},



Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com
```

---

## 3. Proposed flow mapping (stage → template)

The Comms Hub automation engine (`automation_rules`, fires on `job.stage_changed`):

| Trigger (`to` stage) | Template | Fits engine as-is? |
|---|---|---|
| `lead` (on create) | 2.1 Welcome email | ⚠️ no "into lead" event — §4-A |
| `contacted` | 2.2 / 2.3 Survey request | ✅ (pick one default — §4-D) |
| `survey_scheduled` | 2.5 Survey Confirmation | ✅ (needs booked_*/address vars) |
| `quoted` | 2.6 Quotation (or 2.7 for waste) | ✅ (job-type filter — §4-E) |
| `accepted` | 2.12 / 2.13 (pick one — §4-H) | ✅ |
| `confirmed` | 2.16 Removal confirmation | ✅ (needs move_time/address vars) |
| `invoiced` | 2.17 Move Invoice | ✅ (needs attachment — §4-C) |
| `paid` | 2.18 Move Receipt | ✅ (better: payment event — §4-C) |
| `dead` | 2.11 Goodbye | ✅ |
| **Not stage-driven** | 2.8 / 2.9 / 2.10 follow-ups | ❌ no-response timer — §4-B |
| **Not stage-driven** | 2.14 deposit invoice, 2.15 deposit receipt | ❌ invoice/payment event — §4-C |
| **Not stage-driven** | 2.19 Storage invoice | ❌ storage cycle — §4-F |
| **Already built** | 2.20 review request | ❌ Phase 11 owns this — §4-G |
| **Manual only** | 2.4 Photos & List, 2.21 Bank scaffold | — send by hand |

---

## 4. Open questions / flow gaps (need a decision before wiring)

- **§4-A — Welcome email trigger.** There is no automation event for a job *entering* `lead`
  (it's the initial stage). Options: fire it from the enquiry-creation path (new code), or send manually.
- **§4-B — No-response follow-ups (2.8/2.9/2.10).** The engine only fires on stage changes. These are
  "N days after `quoted`, still no reply" timers. Needs either a new dwell-time trigger type + cron,
  or treat as manual. The migration `sub_status` values `followup_sent_1/2` already anticipate this.
- **§4-C — Invoice/receipt emails (2.14/2.15/2.18).** These fire on invoice-created / payment-recorded
  events and carry a PDF attachment. The engine has no payment/invoice trigger and no attachment support
  in the send step yet. Wire from Phase 12 invoice/payment hooks instead?
- **§4-D — Two survey-request variants (2.2 vs 2.3).** Which is the default auto-send? (2.3 is signed
  "Tom Mallett" and omits the home-visit option.)
- **§4-E — Waste-clearance quote (2.7).** Needs a job-type filter so `quoted` sends 2.6 for removals
  and 2.7 for clearances. The engine's `trigger_filters` only support from/to stage today.
- **§4-F — Storage invoice (2.19).** Belongs to `storage_rentals` billing, not the job pipeline; uses
  free-text "(start date)/(end date)" that should become `{{storage_period_start/end}}` vars.
- **§4-G — Review request (2.20).** painless-crm already sends review requests (Phase 11, own cron +
  links). Keep this template as a copy reference only, or replace Phase 11's copy with it?
- **§4-H — accepted-stage overlap (2.12 vs 2.13).** Both ask for the move date. One default, or send 2.12
  then 2.13 as a delayed nudge?
- **§4-I — `{{company_name}}` semantics.** In every template this means the **sender** ("Painless
  Removals Ltd"), but today's render maps `customer_name` from the customer's company. Need a distinct
  sender-company variable sourced from company settings.

---

## 5. Resolutions & wiring (decided 2026-06-03 — ADR-024/025/026)

**Decisions taken with Jay's dev (Laszlo):**
- **Full engine extension.** New event triggers `job.created`, `invoice.created`, `payment.recorded`
  (ADR-024), generalised matcher with `trigger_filters.service_type`, and dwell-guarded follow-ups
  (`action_config.requires_stage`). See STATE_MACHINE.md §5a/§5b.
- **§4-A Welcome** → fired from `job.created` event.
- **§4-B Follow-ups (2.8/2.9/2.10)** → delayed `job.stage_changed` (to=`quoted`) rules with
  `requires_stage:'quoted'`; auto-cancel when the customer responds.
- **§4-C Invoice/receipt (2.14/2.15/2.18)** → `invoice.created` / `payment.recorded` events.
  **Attachments deferred** — text + portal link until Browser Rendering (PDF gen) lands.
- **§4-D Survey variant** → 2.2 (3-option) is the auto-send default; 2.3 stored, not auto-wired.
- **§4-E Waste clearance** → new `jobs.service_type` (ADR-025); `quoted` + `service_type` filter picks
  2.6 (removal) vs 2.7 (waste_clearance).
- **§4-F Storage invoice (2.19)** → seeded as a manual template; storage billing cron is out of scope.
- **§4-G Review (2.20)** → **Phase 11 keeps ownership** (ADR-010 / rule 17). Seeded `active=false` as
  reference copy only; no automation rule.
- **§4-H accepted overlap** → 2.12 sends on `accepted`; 2.13 stored (manual nudge).
- **§4-I `{{company_name}}`** → sender company = `companies.name`.
- **§4 move_time** → new `jobs.arrival_window` (ADR-026); `{{move_time}}` renders it.

**Wiring steps:**
1. Migration `00000000000044`: `jobs.service_type`, `jobs.arrival_window`.
2. Extend merge vocabulary in a pure `src/lib/comms/template-vars.ts` (first_name, last_name,
   customer_name, sender company_name, job_number, move_date, move_time, booked_date/time,
   current/new_address); `buildVars` fetches + delegates.
3. Generalise the matcher + add `enqueueEventAutomation`; add the dwell-guard to the cron.
4. Event producers in `invoices.ts` / `payments.ts` / `jobs.ts`.
5. Seed templates + `automation_rules` in `supabase/seed.sql` (prod = Phase-17 cutover step).
