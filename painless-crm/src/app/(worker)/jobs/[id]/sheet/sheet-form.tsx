'use client';

import type { CustomFieldDef } from '@/lib/custom-fields/defs';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSync } from '../../../_lib/sync-context';

// End-of-job sheet, offline-first via the shared queue (type 'job_sheet').
// Reads the form fields into the queued payload, then enqueues + syncs.
export function SheetForm({
  jobId,
  jobNumber,
  customFieldDefs = [],
  suggestedCubicFt = null,
}: {
  jobId: string;
  jobNumber: string;
  customFieldDefs?: CustomFieldDef[];
  suggestedCubicFt?: number | null;
}) {
  const t = useTranslations('workerApp');
  const router = useRouter();
  const { enqueueAction, online } = useSync();
  const [damage, setDamage] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const actualHours = String(fd.get('actual_hours') ?? '').trim();
    if (actualHours === '') {
      setError(t('sheet.hoursRequired'));
      return;
    }
    setError(null);
    setPhase('saving');
    const clientEventId = globalThis.crypto.randomUUID();
    const customFields: Record<string, string> = {};
    for (const def of customFieldDefs) {
      customFields[def.key] = String(fd.get(`cf_${def.key}`) ?? '');
    }
    await enqueueAction({
      client_event_id: clientEventId,
      type: 'job_sheet',
      endpoint: '/api/worker/job-sheet',
      description: `${t('sheet.heading')} · ${jobNumber}`,
      attempts: 0,
      created_at: Date.now(),
      last_attempt_at: null,
      payload: {
        job_id: jobId,
        client_event_id: clientEventId,
        actual_hours: actualHours,
        actual_cubic_ft: String(fd.get('actual_cubic_ft') ?? ''),
        complications_encountered: String(fd.get('complications_encountered') ?? ''),
        damage_reported: damage,
        damage_details: String(fd.get('damage_details') ?? ''),
        customer_satisfaction_score: String(fd.get('customer_satisfaction_score') ?? ''),
        custom_fields: customFields,
        client_recorded_at: new Date().toISOString(),
      },
    });
    setPhase('saved');
    if (online) router.refresh();
  }

  if (phase === 'saved') {
    return (
      <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
        {online ? t('sheet.submitted') : t('sheet.queued')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label={t('sheet.actualHours')}
        name="actual_hours"
        type="number"
        step="0.25"
        min={0}
        required
      />
      <label className="flex flex-col gap-1 text-sm">
        <span>{t('sheet.actualCubicFt')}</span>
        <input
          type="number"
          name="actual_cubic_ft"
          step="any"
          min={0}
          defaultValue={suggestedCubicFt ?? ''}
          className="rounded-md border px-3 py-2"
        />
        {suggestedCubicFt != null ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('sheet.cubicFtSuggested', { value: suggestedCubicFt })}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('sheet.complications')}
        <textarea
          name="complications_encountered"
          rows={3}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('sheet.satisfaction')}
        <select
          name="customer_satisfaction_score"
          defaultValue=""
          className="rounded-md border bg-transparent px-3 py-2"
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {customFieldDefs.map((def) => (
        <CustomField key={def.key} def={def} />
      ))}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={damage}
          onChange={(e) => setDamage(e.target.checked)}
          className="h-4 w-4"
        />
        {t('sheet.damageReported')}
      </label>
      {damage ? (
        <label className="flex flex-col gap-1 text-sm">
          {t('sheet.damageDetails')}
          <textarea name="damage_details" rows={2} className="rounded-md border px-3 py-2" />
        </label>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <button
        type="submit"
        disabled={phase === 'saving'}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-center font-medium text-[var(--color-primary-foreground)] active:opacity-80 disabled:opacity-50"
      >
        {phase === 'saving' ? t('sheet.submitting') : t('sheet.submit')}
      </button>
    </form>
  );
}

// A tenant-configured extra field (Phase 25, ADR-036). Uncontrolled — read from
// FormData on submit by its cf_<key> name.
function CustomField({ def }: { def: CustomFieldDef }) {
  const name = `cf_${def.key}`;
  const label = (
    <span>
      {def.label}
      {def.required ? <span className="text-[var(--color-danger)]"> *</span> : null}
    </span>
  );

  if (def.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} className="h-4 w-4" />
        {label}
      </label>
    );
  }

  if (def.type === 'select') {
    return (
      <label className="flex flex-col gap-1 text-sm">
        {label}
        <select name={name} defaultValue="" className="rounded-md border bg-transparent px-3 py-2">
          <option value="">—</option>
          {def.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type={def.type === 'number' ? 'number' : 'text'}
        name={name}
        required={def.required}
        className="rounded-md border px-3 py-2"
      />
    </label>
  );
}

function Field({
  label,
  name,
  type,
  step,
  min,
  required,
}: {
  label: string;
  name: string;
  type: string;
  step?: string;
  min?: number;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
      </span>
      <input
        type={type}
        name={name}
        step={step}
        min={min}
        required={required}
        className="rounded-md border px-3 py-2"
      />
    </label>
  );
}
