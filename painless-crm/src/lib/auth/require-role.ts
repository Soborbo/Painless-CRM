import type { AppRole } from '@/lib/schemas/invite';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { AuthedUserProfile } from './types';

const PROFILE_COLUMNS = 'id, auth_id, company_id, email, full_name, role, active';

export async function getAuthedUser(): Promise<AuthedUserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('auth_id', user.id)
    .maybeSingle();

  if (!data || !data.active) return null;
  return data as AuthedUserProfile;
}

export async function requireUser(): Promise<AuthedUserProfile> {
  const profile = await getAuthedUser();
  if (!profile) redirect('/login');
  return profile;
}

export async function requireRole(allowed: readonly AppRole[]): Promise<AuthedUserProfile> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    redirect('/dashboard?error=forbidden');
  }
  return user;
}

export function hasRole(user: AuthedUserProfile, allowed: readonly AppRole[]): boolean {
  return allowed.includes(user.role);
}
