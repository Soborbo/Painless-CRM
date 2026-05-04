'use client';

import { type JobActionState, updateJob } from '@/lib/actions/jobs';
import { ACQUISITION_SOURCES } from '@/lib/schemas/job';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: JobActionState = { status: 'idle' };

type RepOption = { id: string; full_name: string };

export type JobEditDefaults = {
  acquisition_source: string;
  assigned_to_id: string;
  surveyor_id: string;
  move_date: string;
  notes: string;
};

export function JobEditForm({
  id,
  version,
  defaults,
  reps,
  surveyors,
}: {
  id: string;
  version: number;
  defaults: JobEditDefaults;
  reps: RepOption[];
  surveyors: RepOption[];
}) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(updateJob, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('acquisitionSource')}
          <select
            name="acquisition_source"
            defaultValue={defaults.acquisition_source}
            required
            className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
          >
            {ACQUISITION_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`sources.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('moveDate')}
          <input
            type="date"
            name="move_date"
            defaultValue={defaults.move_date}
            className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('assigned')}
          <select
            name="assigned_to_id"
            defaultValue={defaults.assigned_to_id}
            className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
          >
            <option value="">—</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('surveyor')}
          <select
            name="surveyor_id"
            defaultValue={defaults.surveyor_id}
            className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
          >
            <option value="">—</option>
            {surveyors.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t('notes')}
        <textarea
          name="notes"
          rows={4}
          defaultValue={defaults.notes}
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>

      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? tc('loading') : tc('save')}
        </button>
        <Link
          href={`/dashboard/jobs/${id}`}
          className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {tc('cancel')}
        </Link>
      </div>
    </form>
  );
}
