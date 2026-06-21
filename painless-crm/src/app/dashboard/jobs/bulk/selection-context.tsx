'use client';

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

// Shared selection store for the jobs list bulk-edit. The provider is a client
// component; the row checkboxes and the toolbar (both client) read it across the
// server-rendered table in between.
interface JobSelection {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  setMany: (ids: readonly string[], on: boolean) => void;
  clear: () => void;
}

const Context = createContext<JobSelection | null>(null);

export function JobSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: readonly string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo<JobSelection>(
    () => ({ selected, toggle, setMany, clear }),
    [selected, toggle, setMany, clear],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useJobSelection(): JobSelection {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useJobSelection must be used within JobSelectionProvider');
  return ctx;
}
