'use client';

import { type RotaActionState, assignWorker } from '@/lib/actions/rota';
import type { Option } from '@/lib/queries/rota';
import { ASSIGNMENT_ROLES } from '@/lib/rota/conflicts';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: RotaActionState = { status: 'idle' };

export function AssignForm({
  jobId,
  date,
  workers,
  vehicles,
}: {
  jobId: string;
  date: string;
  workers: Option[];
  vehicles: Option[];
}) {
  const t = useTranslations('rota');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(assignWorker, INITIAL);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3 text-sm print:hidden"
    >
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="date" value={date} />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-muted-foreground)]">{t('worker')}</span>
        <select
          name="worker_id"
          required
          defaultValue=""
          className="rounded-md border bg-transparent px-2 py-1.5"
        >
          <option value="" disabled>
            {t('selectWorker')}
          </option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-muted-foreground)]">{t('vehicle')}</span>
        <select
          name="vehicle_id"
          defaultValue=""
          className="rounded-md border bg-transparent px-2 py-1.5"
        >
          <option value="">{t('noVehicle')}</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-muted-foreground)]">{t('role')}</span>
        <select
          name="role"
          defaultValue=""
          className="rounded-md border bg-transparent px-2 py-1.5"
        >
          <option value="">—</option>
          {ASSIGNMENT_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-muted-foreground)]">{t('start')}</span>
        <input type="time" name="scheduled_start" className="rounded-md border px-2 py-1.5" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-muted-foreground)]">{t('end')}</span>
        <input type="time" name="scheduled_end" className="rounded-md border px-2 py-1.5" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? tc('loading') : t('assign')}
      </button>

      {state.status === 'error' ? (
        <p className="w-full text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}
