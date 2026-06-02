import type { TablesInsert } from '@/lib/database.types';
import { createAdminClient } from '@/lib/supabase/admin';

// Phase 15 — notification creation. Notifications are written for *other* users
// (an assignment notifies the assignee, a mention notifies the mentioned), so
// the RLS recipient-only insert policy can't apply — creation runs on the
// service-role admin client. The row shaping is pure + tested; the insert is a
// thin wrapper. Best-effort: a notification failure must never break the action
// that triggered it, so the insert is swallowed.

export const NOTIFICATION_TYPES = [
  'mention',
  'assignment',
  'sla_breach',
  'review_arrived',
  'complaint',
  'damage',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export interface NotificationInput {
  companyId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  priority?: NotificationPriority;
}

const TITLE_MAX = 200;
const BODY_MAX = 500;

export function buildNotificationRow(input: NotificationInput): TablesInsert<'notifications'> {
  const row: TablesInsert<'notifications'> = {
    company_id: input.companyId,
    recipient_user_id: input.recipientUserId,
    type: input.type,
    title: input.title.slice(0, TITLE_MAX),
    priority: input.priority ?? 'normal',
    delivered_channels: ['in_app'],
  };
  if (input.body) row.body = input.body.slice(0, BODY_MAX);
  if (input.linkUrl) row.link_url = input.linkUrl;
  if (input.relatedEntityType) row.related_entity_type = input.relatedEntityType;
  if (input.relatedEntityId) row.related_entity_id = input.relatedEntityId;
  return row;
}

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('notifications').insert(buildNotificationRow(input));
  } catch {
    // Best-effort: never block the triggering action on a notification failure.
  }
}

// Fan-out helper: one notification per recipient (deduped). Skips an empty list
// without touching the DB. Used by @mentions and broadcast-style events.
export async function createNotifications(
  recipients: readonly string[],
  input: Omit<NotificationInput, 'recipientUserId'>,
): Promise<number> {
  const unique = [...new Set(recipients.filter(Boolean))];
  if (unique.length === 0) return 0;
  try {
    const supabase = createAdminClient();
    const rows = unique.map((recipientUserId) =>
      buildNotificationRow({ ...input, recipientUserId }),
    );
    await supabase.from('notifications').insert(rows);
  } catch {
    // Best-effort.
  }
  return unique.length;
}
