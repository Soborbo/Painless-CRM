# Phase 15 — Notifications & Collaboration

**Status**: Skeleton
**Duration estimate**: 2 weeks
**Prerequisite**: Phase 13 (comms infra)

---

## Goal

In-app notification center, push notifications (web + PWA), @mentions in notes, real-time collaboration awareness ("Tom is also viewing this customer"), assignment notifications, daily digest. Make the CRM feel alive.

## Deliverables

1. Notification center: bell icon in top nav, unread count, list of notifications
2. Per-user notification preferences (email digest, push, in-app)
3. Push notifications: web push (Workers + Supabase) for new assignments, mentions, urgent alerts
4. @mention parsing in notes: `@tom` resolves to user, sends notification, links back
5. Real-time presence on records: "Tom is viewing this customer" (via Supabase Realtime)
6. Co-editing protection: optimistic concurrency error shows "Tom edited this 30s ago" with diff
7. Daily digest email: 08:00 every weekday, summary of overnight events per user
8. Notification rules per role (admin gets escalations, sales rep doesn't)

## Schema additions

```sql
create table notifications (
  id uuid primary key,
  company_id uuid not null,
  recipient_user_id uuid not null references users(id),
  type text not null,                -- 'mention', 'assignment', 'sla_breach', 'review_arrived', etc.
  title text not null,
  body text,
  link_url text,                     -- where to navigate when clicked
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  delivered_channels text[],         -- ['in_app', 'email', 'push']
  priority text check (priority in ('low', 'normal', 'high', 'urgent')) default 'normal',
  created_at timestamptz default now()
);

create index notifications_recipient_idx on notifications(recipient_user_id, created_at desc) where read_at is null;

create table notification_preferences (
  user_id uuid primary key references users(id),
  email_digest_enabled boolean default true,
  email_digest_time time default '08:00',
  push_enabled boolean default true,
  push_subscriptions jsonb default '[]',  -- web push endpoints + keys
  channels jsonb default '{}',  -- per-type channel config: { mention: ['email','push'], sla_breach: ['email'] }
  updated_at timestamptz default now()
);

create table presence (
  user_id uuid not null references users(id),
  entity_type text not null,
  entity_id uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);
-- TTL via cron: delete rows older than 5 minutes
```

## @mentions

Notes parser detects `@firstname` or `@firstname.lastname`, resolves against active users in the company. Stores resolved IDs in `notes.mentions[]`. Notification trigger:

```sql
create or replace function notify_mentions() returns trigger as $$
declare
  mention_id uuid;
begin
  foreach mention_id in array NEW.mentions loop
    insert into notifications (
      company_id, recipient_user_id, type, title, body, link_url, related_entity_type, related_entity_id
    ) values (
      NEW.company_id,
      mention_id,
      'mention',
      'You were mentioned',
      left(NEW.body, 200),
      '/dashboard/' || NEW.parent_type || 's/' || NEW.parent_id,
      NEW.parent_type,
      NEW.parent_id
    );
  end loop;
  return NEW;
end;
$$ language plpgsql;

create trigger notes_mention_notify
  after insert on notes
  for each row execute function notify_mentions();
```

## Push notifications

Web Push using VAPID keys. Service worker registered in PWA + main app. Subscriptions stored in `notification_preferences.push_subscriptions` per device.

Send path: notification insert → check preferences → if `push` channel enabled → fetch subscriptions → send via Web Push protocol. Worker `fetch()` to push service.

## Presence

Browser sends heartbeat every 30s for the entity being viewed (customer card, job card). Upserts into `presence` table. Realtime subscription on `presence` filtered by entity ID populates the "X is viewing this" indicator.

## Daily digest

Cloudflare Cron at 07:55 daily:
1. For each user with `email_digest_enabled`:
   - Pull notifications received since last digest
   - Pull jobs assigned to them with status changes overnight
   - Pull SLA breaches
   - Render email template with summary
   - Send via Resend
2. Mark digest sent in `notification_digest_log`

## Acceptance criteria

- [ ] Bell icon shows unread count, click opens list
- [ ] @-mention in note triggers in-app + email + push notification
- [ ] Push works on iOS Safari (16.4+), Chrome Android, desktop browsers
- [ ] Two users on same customer card both see "X is also viewing"
- [ ] Edit conflict shows clear "X edited this Ys ago" with their changes
- [ ] Daily digest email arrives at 08:00 with relevant summary
- [ ] User can disable mentions emails but keep push
- [ ] Notifications older than 90 days auto-archived

## Out of scope

- Slack / Teams integration (post-v1)
- Per-channel time scheduling (e.g., "no push after 7pm")
- Notification grouping (post-v1)
