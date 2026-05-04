'use client';

import { createContext, useContext } from 'react';
import type { ClientUserSummary } from './types';

const UserContext = createContext<ClientUserSummary | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: ClientUserSummary;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): ClientUserSummary {
  const value = useContext(UserContext);
  if (!value) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return value;
}

export function useMaybeUser(): ClientUserSummary | null {
  return useContext(UserContext);
}
