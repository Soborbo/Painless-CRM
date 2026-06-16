import { createClient } from '@/lib/supabase/server';
import type { DayWindow } from '@/lib/queries/home-snapshot';
import type { TaskKind, TaskPriority, TaskRelatedType, TaskStatus } from '@/lib/tasks/model';

// Phase 27 — unified task reads (ADR-042). RLS scopes every read to the
// caller's company. The Supabase client is not bound to the generated
// Database generic (see supabase/server.ts), so rows are narrowed by hand.

export interface TaskAssignee {
  id: string;
  full_name: string;
}

export interface TaskRow {
  id: string;
  kind: TaskKind;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  sort_order: number;
  related_type: TaskRelatedType | null;
  related_id: string | null;
  customer_id: string | null;
  job_id: string | null;
  assignees: TaskAssignee[];
}

const COLUMNS = `
  id, kind, title, description, priority, status, due_at, sort_order,
  related_type, related_id, customer_id, job_id,
  assignees:task_assignees ( user:users (id, full_name) )
`;

function flattenAssignee(raw: unknown): TaskAssignee | null {
  const wrap = raw as { user?: unknown } | null;
  const u = Array.isArray(wrap?.user) ? wrap?.user[0] : wrap?.user;
  const user = u as { id?: string; full_name?: string } | undefined;
  if (!user?.id) return null;
  return { id: user.id, full_name: user.full_name ?? '' };
}

function flatten(raw: Record<string, unknown>): TaskRow {
  const assigneesRaw = (raw.assignees as unknown[] | null) ?? [];
  return {
    id: raw.id as string,
    kind: raw.kind as TaskKind,
    title: raw.title as string,
    description: (raw.description as string | null) ?? null,
    priority: raw.priority as TaskPriority,
    status: raw.status as TaskStatus,
    due_at: (raw.due_at as string | null) ?? null,
    sort_order: (raw.sort_order as number | null) ?? 0,
    related_type: (raw.related_type as TaskRelatedType | null) ?? null,
    related_id: (raw.related_id as string | null) ?? null,
    customer_id: (raw.customer_id as string | null) ?? null,
    job_id: (raw.job_id as string | null) ?? null,
    assignees: assigneesRaw.map(flattenAssignee).filter((a): a is TaskAssignee => a !== null),
  };
}

// Per-job checklist (kind = 'checklist'), incomplete first then by sort order.
export async function listChecklistForJob(jobId: string): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks')
    .select(COLUMNS)
    .eq('job_id', jobId)
    .eq('kind', 'checklist')
    .is('deleted_at', null)
    .order('status', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

// All tasks linked to a given entity (for the entity-detail Tasks panel).
export async function listTasksForEntity(
  relatedType: TaskRelatedType,
  relatedId: string,
): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks')
    .select(COLUMNS)
    .eq('related_type', relatedType)
    .eq('related_id', relatedId)
    .is('deleted_at', null)
    .order('status', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

export interface MyTasksParams {
  userId: string;
  scope: 'mine' | 'all';
  onlyOpen: boolean;
}

// The central worklist. 'mine' resolves the user's task ids via the join table
// first, then fetches the full rows (with all assignees, not just the caller's).
export async function listMyTasks(params: MyTasksParams): Promise<TaskRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from('tasks')
    .select(COLUMNS)
    .is('deleted_at', null)
    .neq('kind', 'checklist')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(500);

  if (params.onlyOpen) query = query.in('status', ['open', 'in_progress']);

  if (params.scope === 'mine') {
    const { data: links } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', params.userId);
    const ids = ((links ?? []) as Array<{ task_id: string }>).map((r) => r.task_id);
    if (ids.length === 0) return [];
    query = query.in('id', ids);
  }

  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

// Open tasks due inside today's window — the owner-home tile.
export async function countTasksDueToday(window: DayWindow): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress'])
    .not('due_at', 'is', null)
    .gte('due_at', window.startIso)
    .lt('due_at', window.endIso);
  return count ?? 0;
}

// Assignee options for the add/reassign controls — any active user in the tenant.
export async function listTaskAssignees(): Promise<TaskAssignee[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('active', true)
    .order('full_name', { ascending: true });
  return ((data ?? []) as Array<{ id: string; full_name: string }>).map((r) => ({
    id: r.id,
    full_name: r.full_name,
  }));
}
