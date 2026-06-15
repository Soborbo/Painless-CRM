'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type RepOption = { id: string; full_name: string };

const FIELD =
  'rounded-lg border bg-transparent px-3 py-2 text-[var(--color-foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--color-primary)]/40';

export function JobsFilters({
  initialQ,
  initialStage,
  initialAssignedTo,
  initialMoveFrom,
  initialMoveTo,
  stages,
  reps,
}: {
  initialQ: string;
  initialStage: string;
  initialAssignedTo: string;
  initialMoveFrom: string;
  initialMoveTo: string;
  stages: string[];
  reps: RepOption[];
}) {
  const router = useRouter();
  const t = useTranslations('jobs');
  const [q, setQ] = useState(initialQ);
  const [stage, setStage] = useState(initialStage);
  const [assignedTo, setAssignedTo] = useState(initialAssignedTo);
  const [moveFrom, setMoveFrom] = useState(initialMoveFrom);
  const [moveTo, setMoveTo] = useState(initialMoveTo);

  // Selects and dates apply instantly; the search box applies on Enter/submit.
  function apply(next: {
    q?: string;
    stage?: string;
    assignedTo?: string;
    moveFrom?: string;
    moveTo?: string;
  }) {
    const v = {
      q: next.q ?? q,
      stage: next.stage ?? stage,
      assignedTo: next.assignedTo ?? assignedTo,
      moveFrom: next.moveFrom ?? moveFrom,
      moveTo: next.moveTo ?? moveTo,
    };
    const params = new URLSearchParams();
    if (v.q.trim()) params.set('q', v.q.trim());
    if (v.stage !== 'all') params.set('stage', v.stage);
    if (v.assignedTo !== 'all') params.set('assigned_to_id', v.assignedTo);
    if (v.moveFrom) params.set('move_from', v.moveFrom);
    if (v.moveTo) params.set('move_to', v.moveTo);
    const view = new URLSearchParams(window.location.search).get('view');
    if (view) params.set('view', view);
    const qs = params.toString();
    router.push(qs ? `/dashboard/jobs?${qs}` : '/dashboard/jobs');
  }

  const hasFilter =
    q.trim() !== '' || stage !== 'all' || assignedTo !== 'all' || moveFrom !== '' || moveTo !== '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({});
      }}
      className="flex flex-wrap items-center gap-2 rounded-xl border bg-[var(--color-background)] p-3 text-sm shadow-sm"
    >
      <div className="relative min-w-56 flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
        >
          ⌕
        </span>
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${FIELD} w-full pl-8`}
        />
      </div>
      <select
        value={stage}
        onChange={(e) => {
          setStage(e.target.value);
          apply({ stage: e.target.value });
        }}
        className={FIELD}
      >
        <option value="all">{t('stageAll')}</option>
        {stages.map((s) => (
          <option key={s} value={s}>
            {t(`stages.${s}` as never)}
          </option>
        ))}
      </select>
      <select
        value={assignedTo}
        onChange={(e) => {
          setAssignedTo(e.target.value);
          apply({ assignedTo: e.target.value });
        }}
        className={FIELD}
      >
        <option value="all">{t('assigneeAll')}</option>
        {reps.map((r) => (
          <option key={r.id} value={r.id}>
            {r.full_name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
        {t('moveFrom')}
        <input
          type="date"
          value={moveFrom}
          max={moveTo || undefined}
          onChange={(e) => {
            setMoveFrom(e.target.value);
            apply({ moveFrom: e.target.value });
          }}
          className={FIELD}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
        {t('moveTo')}
        <input
          type="date"
          value={moveTo}
          min={moveFrom || undefined}
          onChange={(e) => {
            setMoveTo(e.target.value);
            apply({ moveTo: e.target.value });
          }}
          className={FIELD}
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary-foreground)] transition-all duration-150 hover:opacity-90 motion-safe:active:scale-95"
      >
        {t('filter')}
      </button>
      {hasFilter ? (
        <button
          type="button"
          onClick={() => {
            setQ('');
            setStage('all');
            setAssignedTo('all');
            setMoveFrom('');
            setMoveTo('');
            apply({ q: '', stage: 'all', assignedTo: 'all', moveFrom: '', moveTo: '' });
          }}
          className="rounded-lg px-3 py-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          {t('clearFilters')}
        </button>
      ) : null}
    </form>
  );
}
