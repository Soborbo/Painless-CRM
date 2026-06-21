'use client';

import { type RotaActionState, reassignWorker } from '@/lib/actions/rota';
import type { Option, RotaAssignment, RotaJob } from '@/lib/queries/rota';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AssignForm } from './assign-form';
import { AutoAssignButton } from './auto-assign-button';
import { RemoveAssignmentButton } from './remove-button';

type BoardJob = RotaJob & { assignments: RotaAssignment[] };
type Dragged = { id: string; version: number; jobId: string };

const INITIAL: RotaActionState = { status: 'idle' };

export function RotaBoard({
  date,
  jobs,
  workers,
  vehicles,
}: {
  date: string;
  jobs: BoardJob[];
  workers: Option[];
  vehicles: Option[];
}) {
  const t = useTranslations('rota');
  const [state, dispatch, pending] = useActionState(reassignWorker, INITIAL);
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [overJobId, setOverJobId] = useState<string | null>(null);

  function drop(targetJobId: string) {
    const d = dragged;
    setDragged(null);
    setOverJobId(null);
    if (!d || d.jobId === targetJobId) return;
    const fd = new FormData();
    fd.set('id', d.id);
    fd.set('version', String(d.version));
    fd.set('job_id', targetJobId);
    fd.set('date', date);
    dispatch(fd);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-[var(--color-muted-foreground)]">{t('dragHint')}</p>
      {state.status === 'error' ? (
        <p className="rounded-md border border-[var(--color-danger)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}

      {jobs.map((job) => {
        const isOver = overJobId === job.id && dragged !== null && dragged.jobId !== job.id;
        return (
          <section
            key={job.id}
            onDragOver={(e) => {
              if (!dragged) return;
              e.preventDefault();
              setOverJobId(job.id);
            }}
            onDragLeave={() => setOverJobId((cur) => (cur === job.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              drop(job.id);
            }}
            className={`rounded-md border transition-colors ${
              isOver ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : ''
            } ${pending ? 'opacity-70' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[var(--color-muted)]/40 px-4 py-2">
              <h2 className="font-medium">
                <Link href={`/dashboard/jobs/${job.id}`} className="hover:underline">
                  {job.job_number}
                </Link>{' '}
                · {job.customer_name}
              </h2>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {t('assignedCount', { count: job.assignments.length })}
              </span>
            </div>

            <div className="flex flex-col gap-2 px-4 py-3">
              {job.assignments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">{t('noneAssigned')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {job.assignments.map((a) => (
                    <li
                      key={a.id}
                      draggable={!pending}
                      onDragStart={() =>
                        setDragged({ id: a.id, version: a.version, jobId: job.id })
                      }
                      onDragEnd={() => {
                        setDragged(null);
                        setOverJobId(null);
                      }}
                      className="flex cursor-grab flex-wrap items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1 hover:border-[var(--color-border)] hover:bg-[var(--color-muted)]/40 active:cursor-grabbing"
                    >
                      <span>
                        <span aria-hidden className="mr-1.5 text-[var(--color-muted-foreground)]">
                          ⠿
                        </span>
                        <span className="font-medium">{a.worker_name}</span>
                        {meta(a, t) ? (
                          <span className="text-[var(--color-muted-foreground)]">
                            {' '}
                            — {meta(a, t)}
                          </span>
                        ) : null}
                      </span>
                      <RemoveAssignmentButton id={a.id} version={a.version} date={date} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <AssignForm jobId={job.id} date={date} workers={workers} vehicles={vehicles} />
                <AutoAssignButton jobId={job.id} date={date} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function meta(a: RotaAssignment, t: ReturnType<typeof useTranslations>): string {
  const role = a.role ? t(`roles.${a.role}`) : '';
  return [role, a.vehicle_registration, timeWindow(a)].filter(Boolean).join(' · ');
}

function timeWindow(a: RotaAssignment): string {
  const fmt = (s: string | null) => (s ? s.slice(0, 5) : null);
  const start = fmt(a.scheduled_start);
  const end = fmt(a.scheduled_end);
  if (start && end) return `${start}–${end}`;
  if (start) return `${start}–`;
  return '';
}
