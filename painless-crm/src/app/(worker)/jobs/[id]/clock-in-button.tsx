'use client';

import { type ClockInState, clockIn } from '@/lib/actions/worker-clock-in';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';

const INITIAL: ClockInState = { status: 'idle' };

type Coords = { lat: number; lng: number; acc: number | null };

export function ClockInButton({ jobId }: { jobId: string }) {
  const t = useTranslations('workerApp');
  const [state, action, pending] = useActionState(clockIn, INITIAL);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [located, setLocated] = useState<'pending' | 'ok' | 'unavailable'>('pending');
  // Stable per-attempt id so a retried submit dedups server-side (ADR-011).
  const [eventId] = useState(() => globalThis.crypto.randomUUID());
  const [recordedAt] = useState(() => new Date().toISOString());

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

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="client_event_id" value={eventId} />
      <input type="hidden" name="client_recorded_at" value={recordedAt} />
      <input type="hidden" name="gps_lat" value={coords?.lat ?? ''} />
      <input type="hidden" name="gps_lng" value={coords?.lng ?? ''} />
      <input type="hidden" name="gps_accuracy_m" value={coords?.acc ?? ''} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-center font-medium text-[var(--color-primary-foreground)] transition-opacity active:opacity-80 disabled:opacity-50"
      >
        {pending ? t('clockingIn') : t('clockIn')}
      </button>

      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        {located === 'pending'
          ? t('locating')
          : located === 'ok'
            ? t('locationReady')
            : t('locationUnavailable')}
      </p>

      {state.status === 'error' ? (
        <p className="text-center text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}
