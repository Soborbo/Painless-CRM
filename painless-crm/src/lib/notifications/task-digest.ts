import { todayWindow } from '@/lib/queries/home-snapshot';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitEvent } from './emit';

// Phase 27 follow-up (ADR-042) — daily task digest producer. Emits a `task.due`
// or `task.overdue` in-app notification to each assignee of every open task due
// by end of today. The existing notify-* sweeps then email these per each
// recipient's subscription. Runs service-role (cross-tenant); emitEvent scopes
// every row to the task's own company.

export interface TaskDigestResult {
  due: number;
  overdue: number;
  notified: number;
}

interface DigestTaskRow {
  id: string;
  company_id: string;
  title: string;
  job_id: string | null;
  due_at: string;
  assignees: Array<{ user_id: string }> | null;
}

export async function runTaskDigest(now: Date = new Date()): Promise<TaskDigestResult> {
  const supabase = createAdminClient();
  const { startIso, endIso } = todayWindow(now);

  const { data } = await supabase
    .from('tasks')
    .select('id, company_id, title, job_id, due_at, assignees:task_assignees(user_id)')
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress'])
    .not('due_at', 'is', null)
    .lt('due_at', endIso)
    .limit(2000);

  const rows = (data ?? []) as DigestTaskRow[];
  const result: TaskDigestResult = { due: 0, overdue: 0, notified: 0 };

  for (const task of rows) {
    const overdue = task.due_at < startIso;
    if (overdue) result.overdue += 1;
    else result.due += 1;
    const link = task.job_id ? `/dashboard/jobs/${task.job_id}` : '/dashboard/tasks';
    for (const a of task.assignees ?? []) {
      result.notified += await emitEvent({
        companyId: task.company_id,
        eventKey: overdue ? 'task.overdue' : 'task.due',
        title: task.title,
        linkUrl: link,
        relatedEntityType: 'task',
        relatedEntityId: task.id,
        recipientUserId: a.user_id,
      });
    }
  }

  return result;
}
