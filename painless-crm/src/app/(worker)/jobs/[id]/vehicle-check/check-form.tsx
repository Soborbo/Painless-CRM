'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSync } from '../../../_lib/sync-context';

// Vehicle pre-check, offline-first via the shared queue (type 'vehicle_check').
// Dashboard photo + signature are deferred to the Storage slice.
export function VehicleCheckForm({
  jobId,
  vehicleId,
  registration,
}: {
  jobId: string;
  vehicleId: string;
  registration: string;
}) {
  const t = useTranslations('workerApp');
  const router = useRouter();
  const { enqueueAction, online } = useSync();
  const [clear, setClear] = useState(true);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const defects = String(fd.get('defects_noted') ?? '').trim();
    if (!clear && defects === '') {
      setError(t('check.defectsRequired'));
      return;
    }
    setError(null);
    setPhase('saving');
    const clientEventId = globalThis.crypto.randomUUID();
    await enqueueAction({
      client_event_id: clientEventId,
      type: 'vehicle_check',
      endpoint: '/api/worker/vehicle-check',
      description: `${t('check.heading')} · ${registration}`,
      attempts: 0,
      created_at: Date.now(),
      last_attempt_at: null,
      payload: {
        job_id: jobId,
        vehicle_id: vehicleId,
        client_event_id: clientEventId,
        date: new Date().toISOString().slice(0, 10),
        fuel_level: String(fd.get('fuel_level') ?? ''),
        mileage: String(fd.get('mileage') ?? ''),
        walk_around_clear: clear ? 'true' : 'false',
        defects_noted: defects,
        client_recorded_at: new Date().toISOString(),
      },
    });
    setPhase('saved');
    if (online) router.refresh();
  }

  if (phase === 'saved') {
    return (
      <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
        {online ? t('check.submitted') : t('check.queued')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {t('check.fuelLevel')}
        <input
          type="number"
          name="fuel_level"
          min={0}
          max={100}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('check.mileage')}
        <input type="number" name="mileage" min={0} className="rounded-md border px-3 py-2" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={clear}
          onChange={(e) => setClear(e.target.checked)}
          className="h-4 w-4"
        />
        {t('check.walkAroundClear')}
      </label>

      {!clear ? (
        <label className="flex flex-col gap-1 text-sm">
          {t('check.defects')}
          <textarea name="defects_noted" rows={3} className="rounded-md border px-3 py-2" />
        </label>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <button
        type="submit"
        disabled={phase === 'saving'}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-center font-medium text-[var(--color-primary-foreground)] active:opacity-80 disabled:opacity-50"
      >
        {phase === 'saving' ? t('check.submitting') : t('check.submit')}
      </button>
    </form>
  );
}
