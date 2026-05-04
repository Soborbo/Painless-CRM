# Audit Log Pattern

Every mutation to a tenant data table is logged automatically via Postgres triggers. This document explains the contract and how to wire new tables into it.

## Why automatic, not application-side?

Application code makes mistakes. Manual `insert into activity_log` calls get forgotten. A trigger guarantees the log captures every change — even from psql sessions, even from migration scripts (with the right context), even from forgotten code paths.

The trigger is deterministic: it sees the OLD and NEW row state and writes the diff. No reasoning required.

---

## The contract

Every mutating table has an `AFTER INSERT OR UPDATE OR DELETE` trigger that calls `log_activity()`. The trigger writes to `activity_log` with:

- `company_id` — copied from the row
- `entity_type` — the table name
- `entity_id` — the row's `id`
- `action` — `'create' | 'update' | 'soft_delete' | 'undelete' | 'hard_delete'`
- `before` — full OLD row as JSONB (null on insert)
- `after` — full NEW row as JSONB (null on hard delete)
- `actor_id` — resolved from `auth.uid()` if available
- `occurred_at` — `now()`

Soft delete is detected via JSONB cast: `(to_jsonb(NEW)->>'deleted_at') IS NOT NULL AND (to_jsonb(OLD)->>'deleted_at') IS NULL`. The JSONB cast pattern is critical — see ADR-007. Direct `NEW.deleted_at` access fails on the 49 of 58 tables that don't have that column. The defensive pattern lets us attach this trigger to any table.

---

## The trigger function (v2 defensive)

(Defined in `references/schema.sql`, repeated here for reference.)

```sql
create or replace function log_activity()
returns trigger language plpgsql security definer as $$
declare
  v_actor_id uuid;
  v_action text;
  v_new_jsonb jsonb;
  v_old_jsonb jsonb;
  v_company_id uuid;
  v_entity_id uuid;
begin
  -- Resolve actor (may be null for service-role mutations)
  begin
    select id into v_actor_id from users where auth_id = auth.uid() limit 1;
  exception when others then
    v_actor_id := null;
  end;

  -- Convert NEW/OLD to JSONB once. JSONB lookups via ->> are safe even when
  -- the column doesn't exist on the row type (returns null instead of throwing).
  -- This is the defensive pattern that lets us attach this trigger to ANY table.
  if TG_OP <> 'INSERT' then v_old_jsonb := to_jsonb(OLD); end if;
  if TG_OP <> 'DELETE' then v_new_jsonb := to_jsonb(NEW); end if;

  if (TG_OP = 'INSERT') then
    v_action := 'create';
  elsif (TG_OP = 'UPDATE') then
    v_action := case
      when (v_new_jsonb->>'deleted_at') is not null
       and (v_old_jsonb->>'deleted_at') is null then 'soft_delete'
      when (v_new_jsonb->>'deleted_at') is null
       and (v_old_jsonb->>'deleted_at') is not null then 'undelete'
      else 'update'
    end;
  elsif (TG_OP = 'DELETE') then
    v_action := 'hard_delete';
  end if;

  -- Resolve company_id and entity_id defensively (column may not exist on this table)
  v_company_id := coalesce(
    (v_new_jsonb->>'company_id')::uuid,
    (v_old_jsonb->>'company_id')::uuid
  );
  v_entity_id := coalesce(
    (v_new_jsonb->>'id')::uuid,
    (v_old_jsonb->>'id')::uuid
  );

  -- Skip audit on tables without company_id (e.g., 'companies' itself, 'activity_log').
  -- These are explicitly intended to be NO_AUDIT.
  if v_company_id is null then
    return coalesce(NEW, OLD);
  end if;

  insert into activity_log (
    company_id, entity_type, entity_id, action, before, after, actor_id, occurred_at
  ) values (
    v_company_id, TG_TABLE_NAME, v_entity_id, v_action,
    v_old_jsonb, v_new_jsonb, v_actor_id, now()
  );
  return coalesce(NEW, OLD);
end;
$$;
```

---

## Wiring a new table

When you create a new mutable table in a migration, add the trigger:

```sql
-- After creating my_new_table
create trigger my_new_table_audit
  after insert or update or delete on my_new_table
  for each row execute function log_activity();

-- Also: enable RLS so users can't insert/update/delete activity_log directly
-- (already done globally on activity_log; mentioned for awareness)
```

Tables that need the trigger:
- `customers`, `customer_contacts`, `customer_relationships`, `customer_consents`
- `addresses`
- `jobs`, `job_addresses`, `job_status_history`, `job_tags`, `job_assignments`
- `quotes`, `quote_variants`, `quote_acceptances`, `pricing_versions`
- `vehicles`, `vehicle_compliance`, `vehicle_assignments`, `vehicle_checks`
- `storage_sites`, `storage_containers`, `storage_rentals`
- `workers`, `worker_availability`
- `time_entries`, `surveys`, `cubic_sheet_items`, `job_sheets`
- `customer_signoffs`, `review_requests`, `complaints`, `damage_claims`
- `invoices`, `invoice_lines`, `payments`, `direct_debit_mandates`
- `email_templates`, `sms_templates`, `whatsapp_templates`, `automation_rules`
- `messages`, `phone_calls`, `notes`, `photos`
- `affiliates`, `affiliate_codes`, `attributions`, `commission_records`
- `notifications`, `notification_preferences`
- `settings`, `users`, `workers`, `user_invitations`

Tables that DON'T need it:
- `activity_log` itself (would be infinite recursion)
- `companies` (platform-level; super_admin operations logged separately to `support_audit_log`)
- `webhook_events` (operational, append-only by design)
- `automation_queue` (operational)
- `presence` (high-churn, no audit value)

---

## What the activity_log gives you

### 1. Customer / job timeline

Every change to a customer's record, every job stage transition, every note added — chronologically presented in the customer 360 → Activity tab and job → Activity tab.

```sql
select * from activity_log
where company_id = current_user_company_id()
  and entity_type = 'customers'
  and entity_id = $customer_id
order by occurred_at desc
limit 100;
```

### 2. "Who changed this?" answer

Customer contact info wrong? Look at activity log to see when it changed and by whom. Supports trust and accountability.

### 3. Recovery from accidental edit

Soft delete recovery: read the `after` snapshot at the point right before deletion, restore values.

```sql
-- Recovery query: find the state before a soft delete
select after from activity_log
where company_id = current_user_company_id()
  and entity_type = 'customers'
  and entity_id = $customer_id
  and action = 'update'
order by occurred_at desc
limit 1;
```

### 4. Audit trail for compliance / disputes

If a customer disputes a price or a date change, the log is the source of truth. Cannot be tampered with by users.

### 5. Detection of unusual patterns

Cron-driven anomaly detection (Phase 16): "User X made 500 changes in the last hour" → admin alert. Most users do <50/day.

---

## What NOT to log

The `activity_log` is for **state changes that mattered to a user**. It's not for:

- HTTP request logs (Cloudflare Workers logs handle this)
- Application-level errors (Sentry handles this)
- Business analytics events (separate analytics tables, not activity_log)
- Read access (this would be a separate access log; not required for v1)

Bad: logging a "customer card viewed" event → fills up the table with low-value rows.
Good: logging a "customer marketing_consent toggled" event → high-value, fits the model.

---

## Performance considerations

`activity_log` will grow large. After a year on Painless: ~500K rows expected.

Mitigations:
1. **Partition by month** — when row count > 1M, switch to monthly partitions. Old months can be moved to cheaper storage.
2. **Index on `(entity_type, entity_id, occurred_at desc)`** — covers the timeline-per-record use case efficiently.
3. **Index on `(company_id, occurred_at desc)`** — for tenant-wide audit queries.
4. **Don't query without an entity filter** — full table scans on activity_log are slow. UI never does this.

JSONB `before`/`after` columns are large. Consider compression at the column level (PostgreSQL TOAST handles this automatically; just be aware).

---

## Manual entries

Sometimes you want to log something the trigger wouldn't catch. Examples:
- "Customer requested data deletion under GDPR" — not a row mutation, but a meaningful event
- "Admin temporarily granted super_admin access to fix issue" — meta-event

For these, insert manually with a clear `action`:

```sql
insert into activity_log (
  company_id, entity_type, entity_id, action, before, after, actor_id, actor_label
) values (
  $company_id, 'customer', $customer_id, 'gdpr_erasure_requested',
  null, jsonb_build_object('reason', 'customer email request', 'received_at', now()),
  $admin_id, 'admin (manual)'
);
```

The `actor_label` field is for cases where the actor is a system or external party, not a tenant user.

---

## Activity feed in the UI

The customer 360 → Activity tab and job → Activity tab render the log with friendly labels:

```ts
function describeActivityEntry(entry: ActivityLogRow): string {
  switch (entry.action) {
    case 'create':
      return `Created ${entry.entity_type}`;
    case 'update': {
      const changes = diff(entry.before, entry.after);
      return `Updated ${formatChanges(changes)}`;
    }
    case 'soft_delete':
      return `Removed`;
    case 'gdpr_erasure_requested':
      return `Customer requested data deletion`;
    // ...
  }
}
```

For `update` actions, render only the fields that actually changed (diff between before/after) for human-readable history.

---

## Tests

Every Phase 2+ table CI suite includes a test that:
1. Inserts a row → verify activity_log entry with `action='create'`
2. Updates the row → verify entry with `action='update'`, correct before/after
3. Soft-deletes → verify entry with `action='soft_delete'`
4. Verifies actor_id resolved correctly when called from authenticated context

If audit log tests fail, build fails. The audit log is not optional.
