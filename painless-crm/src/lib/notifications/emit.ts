import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification, createNotifications, type NotificationPriority } from './create';
import { getEvent } from './events';
import { parseEventPrefs, resolveSubscribers, type SubscriberPref } from './prefs';

// Central producer entry point. Emits a catalog event as in-app notification
// row(s); the email side is handled later by the sweeps, which read each
// recipient's per-event frequency. Best-effort throughout — a notification
// failure must never break the action that triggered it.
//
//  • broadcast events fan out to every active company user whose effective
//    frequency for the event is not 'off' (catalog default applies when unset).
//  • targeted events go to the one intrinsic recipient (assignee / mentioned),
//    always creating the in-app row; the subscription only gates the email.

export interface EmitEventInput {
  companyId: string;
  eventKey: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  priority?: NotificationPriority;
  /** Required for targeted events; ignored for broadcast events. */
  recipientUserId?: string | null;
}

export async function emitEvent(input: EmitEventInput): Promise<number> {
  const event = getEvent(input.eventKey);
  const scope = event?.scope ?? 'broadcast';

  const shared = {
    companyId: input.companyId,
    type: input.eventKey,
    title: input.title,
    body: input.body ?? null,
    linkUrl: input.linkUrl ?? null,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    priority: input.priority,
  };

  if (scope === 'targeted') {
    if (!input.recipientUserId) return 0;
    await createNotification({ ...shared, recipientUserId: input.recipientUserId });
    return 1;
  }

  const subscribers = await loadSubscribers(input.companyId, input.eventKey);
  return createNotifications(subscribers, shared);
}

// Active company users whose effective frequency for the event is not 'off'.
// Includes users with no preference row (they inherit the catalog default).
async function loadSubscribers(companyId: string, eventKey: string): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data: userRows } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .eq('active', true);
    const userIds = (userRows ?? []).map((u) => (u as { id: string }).id);
    if (userIds.length === 0) return [];

    const { data: prefRows } = await supabase
      .from('notification_preferences')
      .select('user_id, event_prefs')
      .in('user_id', userIds);
    const prefsByUser = new Map<string, ReturnType<typeof parseEventPrefs>>();
    for (const p of (prefRows ?? []) as Array<{ user_id: string; event_prefs: unknown }>) {
      prefsByUser.set(p.user_id, parseEventPrefs(p.event_prefs));
    }

    const candidates: SubscriberPref[] = userIds.map((id) => ({
      user_id: id,
      prefs: prefsByUser.get(id) ?? {},
    }));
    return resolveSubscribers(candidates, eventKey);
  } catch {
    return [];
  }
}
