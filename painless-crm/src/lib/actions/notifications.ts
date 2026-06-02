'use server';

import { requireUser } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Phase 15 — mark notifications read. The RLS recipient-update policy is the
// security boundary (a user can only update their own rows), so these actions
// stay thin: authenticate, then a scoped update. read_at is a simple flag, so
// no optimistic-concurrency version dance is needed.

const MarkReadSchema = z.object({ id: z.string().uuid() });

export type NotificationActionState = { status: 'idle' } | { status: 'ok' } | { status: 'error' };

export async function markNotificationRead(id: string): Promise<NotificationActionState> {
  await requireUser();
  const parsed = MarkReadSchema.safeParse({ id });
  if (!parsed.success) return { status: 'error' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .is('read_at', null);
  if (error) return { status: 'error' };

  revalidatePath('/dashboard/notifications');
  revalidatePath('/dashboard');
  return { status: 'ok' };
}

export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) return { status: 'error' };

  revalidatePath('/dashboard/notifications');
  revalidatePath('/dashboard');
  return { status: 'ok' };
}

// Form-action wrappers (return void) for plain <form action={...}> usage on the
// notification center page.
export async function markNotificationReadForm(formData: FormData): Promise<void> {
  await markNotificationRead(String(formData.get('id') ?? ''));
}

export async function markAllNotificationsReadForm(): Promise<void> {
  await markAllNotificationsRead();
}
