'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSync } from '../../_lib/sync-context';

type Coords = { lat: number; lng: number; acc: number | null };

// Clock-in is offline-first (ADR-011): it writes to the durable queue and lets
// the sync engine replay it (immediately if online). The button never blocks on
// the network, so a clock-in in a signal black spot is never lost.
export function ClockInButton({ jobId, jobNumber }: { jobId: string; jobNumber: string }) {
  const t = useTranslations('workerApp');
  const router = useRouter();
  const { enqueueAction, online } = useSync();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [located, setLocated] = useState<'pending' | 'ok' | 'unavailable'>('pending');
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [eventId] = useState(() => globalThis.crypto.randomUUID());

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocated('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
        setLocated('ok');
      },
      () => setLocated('unavailable'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  async function handleClockIn() {
    setPhase('saving');
    await enqueueAction({
      client_event_id: eventId,
      type: 'clock_in',
      endpoint: '/api/worker/clock-in',
      description: `Clock-in · ${jobNumber}`,
      attempts: 0,
      created_at: Date.now(),
      last_attempt_at: null,
      payload: {
        job_id: jobId,
        client_event_id: eventId,
        gps_lat: coords?.lat ?? null,
        gps_lng: coords?.lng ?? null,
        gps_accuracy_m: coords?.acc ?? null,
        client_recorded_at: new Date().toISOString(),
      },
    });
    setPhase('saved');
    // If it synced (online) the server now has the clock-in → refresh to show it.
    if (online) router.refresh();
  }

  if (phase === 'saved') {
    return (
      <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
        {online ? t('clockInRecorded') : t('clockInQueued')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClockIn}
        disabled={phase === 'saving'}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-center font-medium text-[var(--color-primary-foreground)] transition-opacity active:opacity-80 disabled:opacity-50"
      >
        {phase === 'saving' ? t('clockingIn') : t('clockIn')}
      </button>
      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        {located === 'pending'
          ? t('locating')
          : located === 'ok'
            ? t('locationReady')
            : t('locationUnavailable')}
      </p>
    </div>
  );
}
