import { createClient } from '@/lib/supabase/server';

// Phase 15 — notification reads for the signed-in user. RLS scopes every read
// to the recipient (notifications_recipient_read), so no explicit user filter
// is needed here; the policy is the security boundary.

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  priority: string | null;
  read_at: string | null;
  created_at: string;
}

const LIST_COLUMNS = 'id, type, title, body, link_url, priority, read_at, created_at';
const LIST_LIMIT = 50;

export async function listMyNotifications(limit = LIST_LIMIT): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}

export async function countMyUnread(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}
