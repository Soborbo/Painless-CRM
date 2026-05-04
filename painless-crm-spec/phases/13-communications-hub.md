# Phase 13 — Communications Hub

**Status**: Skeleton
**Duration estimate**: 4 weeks
**Prerequisite**: Phase 03 (customers), Phase 04 (jobs)

---

## Goal

Single inbox for all customer comms: email, SMS, WhatsApp. Templates (with variables). Automation engine: "when job stage changes to X, send template Y". Two-way conversations on customer/job timelines. Inbound call logging from Tamar (email parsing).

## Deliverables

1. Email send via Resend with templates + tracking (opens, clicks)
2. SMS send via Twilio (UK GBP cheapest path)
3. WhatsApp Business API via Meta (cheaper than Twilio for WhatsApp; 1–2w template approval lead time)
4. Template library: per channel, per company, with merge variables
5. Automation engine: rule = `{ trigger: 'job.stage_changed', from: 'quoted', to: 'declined', delay: '24h', action: 'send_email', template_id: '...' }`
6. Two-way conversations: customer replies → message arrives in CRM, threaded on job/customer
7. Tamar email parsing: when Tamar sends call notification email to a forwarding address, parse and create `phone_calls` record, link to customer by phone number
8. Manual call logging: rep notes a call from the customer card
9. Bulk send (filtered customer list → templated email/SMS) — admin only, with consent enforcement

## Key decisions

- **DECISION**: Tamar Partner API access — pursue parallel; if granted before Phase 13 ships, swap email parser for direct API
- **DECISION**: WhatsApp template approval is the critical path; submit templates Week 1 of this phase
- **DECISION**: Inbound email replies — use Resend Inbound (or Cloudflare Email Workers) to parse customer replies and thread them; identify by reply-to + Message-Id chain

## Schema additions

```sql
create table email_templates (
  id uuid primary key,
  company_id uuid not null,
  name text not null,
  category text,  -- 'quote_followup', 'invoice_reminder', etc.
  subject_template text not null,
  body_template text not null,        -- markdown with {{variables}}
  body_html_template text,             -- optional override
  variables_schema jsonb,              -- list of expected variables
  active boolean default true,
  created_by_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sms_templates (
  id uuid primary key,
  company_id uuid not null,
  name text not null,
  body_template text not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table whatsapp_templates (
  id uuid primary key,
  company_id uuid not null,
  name text not null,
  meta_template_id text unique,        -- after Meta approval
  meta_template_status text check (meta_template_status in ('pending', 'approved', 'rejected')),
  body_template text not null,
  variables_schema jsonb,
  category text check (category in ('marketing', 'utility', 'authentication')),
  language text default 'en',
  created_at timestamptz default now()
);

create table automation_rules (
  id uuid primary key,
  company_id uuid not null,
  name text not null,
  trigger_event text not null,       -- 'job.stage_changed', 'invoice.overdue_3d', 'storage.payment_failed'
  trigger_filters jsonb,             -- e.g., { from: 'quoted', to: 'declined' }
  delay_seconds int default 0,
  action_type text check (action_type in ('send_email', 'send_sms', 'send_whatsapp', 'create_task', 'webhook')),
  action_config jsonb not null,      -- e.g., { template_id: '...', to: 'customer.primary_email' }
  active boolean default true,
  last_run_at timestamptz,
  run_count int default 0,
  created_by_id uuid references users(id),
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key,
  company_id uuid not null,
  customer_id uuid references customers(id),
  job_id uuid references jobs(id),
  channel text check (channel in ('email', 'sms', 'whatsapp', 'phone')),
  direction text check (direction in ('outbound', 'inbound')),
  template_id uuid,                  -- if templated
  subject text,                      -- email
  body text not null,
  body_html text,
  -- Provider tracking
  provider text,                     -- 'resend', 'twilio', 'meta_whatsapp', 'tamar', 'manual'
  provider_message_id text,
  status text,                       -- 'queued', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'replied'
  -- Sender / recipient
  from_address text,
  to_address text,
  sent_by_user_id uuid references users(id),
  -- Threading
  in_reply_to_message_id uuid references messages(id),
  thread_id uuid,                    -- shared by all messages in a conversation
  -- Timestamps
  sent_at timestamptz default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  -- Inbound only
  raw_payload jsonb,
  -- Audit
  created_at timestamptz default now()
);

create index messages_customer_idx on messages(customer_id, sent_at desc);
create index messages_job_idx on messages(job_id, sent_at desc);
create index messages_thread_idx on messages(thread_id);

create table phone_calls (
  id uuid primary key,
  company_id uuid not null,
  customer_id uuid references customers(id),
  job_id uuid references jobs(id),
  direction text check (direction in ('inbound', 'outbound')),
  caller_number text,
  called_number text,
  duration_seconds int,
  recording_url text,
  user_id uuid references users(id),  -- who took / made the call
  notes text,
  source text check (source in ('tamar_email', 'tamar_api', 'manual')),
  occurred_at timestamptz not null,
  created_at timestamptz default now()
);
```

## Automation engine

Postgres `LISTEN/NOTIFY` triggers on `jobs.stage` change, plus a Cloudflare Cron for time-delayed rules:

```sql
create or replace function emit_automation_event() returns trigger as $$
begin
  -- Insert into automation_queue with delay
  insert into automation_queue (
    company_id, rule_id, trigger_event, payload, scheduled_for
  )
  select
    NEW.company_id,
    r.id,
    r.trigger_event,
    jsonb_build_object('job_id', NEW.id, 'from', OLD.stage, 'to', NEW.stage),
    now() + (r.delay_seconds || ' seconds')::interval
  from automation_rules r
  where r.company_id = NEW.company_id
    and r.active = true
    and r.trigger_event = 'job.stage_changed'
    and (r.trigger_filters->>'from' is null or r.trigger_filters->>'from' = OLD.stage::text)
    and (r.trigger_filters->>'to' is null or r.trigger_filters->>'to' = NEW.stage::text);
  return NEW;
end;
$$ language plpgsql;
```

Cron worker every 60s: pulls due rows from `automation_queue`, executes action (Resend send, Twilio send, etc.), logs to `messages` + marks `automation_rules.last_run_at`.

Idempotent: each `automation_queue` row processed at most once (FOR UPDATE SKIP LOCKED).

## Tamar email parsing

Forwarding address `crm-calls@painlessremovals.com` (Resend Inbound or Cloudflare Email Workers). When Tamar sends a notification:

```
From: notifications@tamar.co.uk
Subject: Inbound call notification
Body: Caller 07700900123 called 01179000000 at 14:32 for 3m 21s. Recording: https://...
```

Parser extracts: caller, called, duration, occurred_at, recording. Looks up customer by phone. Creates `phone_calls` row. Notifies the assigned rep.

If Tamar Partner API becomes available: replace the parser with direct API listener — same `phone_calls` table, source flips to `tamar_api`.

## Acceptance criteria

- [ ] Email template + send + delivered + opened tracked
- [ ] SMS template + send via Twilio
- [ ] WhatsApp template approved + send via Meta API
- [ ] Quoted → declined transition triggers 24h-delayed reminder email (configurable)
- [ ] Customer replies to email → threaded on job timeline
- [ ] Tamar email parsed, phone_calls row created, rep notified
- [ ] Bulk send respects marketing consent (skips opt-outs)
- [ ] Activity feed shows unified comms (email, SMS, WhatsApp, calls)

## Out of scope

- Inbound call recording playback in CRM (link out to Tamar)
- Call sentiment analysis (post-v1)
- Multi-channel cadences (Outreach.io-style) (post-v1)
