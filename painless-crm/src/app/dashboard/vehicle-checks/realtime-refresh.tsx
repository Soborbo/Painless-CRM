'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Phase 09 — live-refresh the vehicle-check admin list as workers submit checks.
// Supabase Realtime (migration 49 adds vehicle_checks to the publication). If
// Realtime is not enabled in this environment the subscription simply never
// fires — the server-rendered list still works, so this degrades gracefully.
export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('vehicle-checks-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vehicle_checks' },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
