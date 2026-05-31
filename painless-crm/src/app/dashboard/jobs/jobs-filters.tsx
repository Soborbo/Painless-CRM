'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type RepOption = { id: string; full_name: string };

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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (stage !== 'all') params.set('stage', stage);
    if (assignedTo !== 'all') params.set('assigned_to_id', assignedTo);
    if (moveFrom) params.set('move_from', moveFrom);
    if (moveTo) params.set('move_to', moveTo);
    const qs = params.toString();
    router.push(qs ? `/dashboard/jobs?${qs}` : '/dashboard/jobs');
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3 text-sm">
      <input
        type="search"
        placeholder={t('searchPlaceholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="min-w-64 flex-1 rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
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
        onChange={(e) => setAssignedTo(e.target.value)}
        className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
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
          onChange={(e) => setMoveFrom(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-2 text-[var(--color-foreground)] outline-none focus:ring-2"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
        {t('moveTo')}
        <input
          type="date"
          value={moveTo}
          min={moveFrom || undefined}
          onChange={(e) => setMoveTo(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-2 text-[var(--color-foreground)] outline-none focus:ring-2"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
      >
        {t('filter')}
      </button>
    </form>
  );
}
