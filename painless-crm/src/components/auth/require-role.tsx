'use client';

import { useMaybeUser } from '@/lib/auth/user-context';
import type { AppRole } from '@/lib/schemas/invite';
import type { ReactNode } from 'react';

export function RequireRole({
  allowed,
  fallback = null,
  children,
}: {
  allowed: readonly AppRole[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const user = useMaybeUser();
  if (!user || !allowed.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
