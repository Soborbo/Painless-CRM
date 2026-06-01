'use client';

import { type SurveyActionState, createSurvey, updateSurvey } from '@/lib/actions/surveys';
import type { SurveyRow } from '@/lib/queries/surveys';
import { useActionState } from 'react';

const INITIAL: SurveyActionState = { status: 'idle' };

const TYPES: { value: string; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'video_self', label: 'Video (customer-recorded)' },
  { value: 'video_live', label: 'Video (live call)' },
  { value: 'estimate_only', label: 'Estimate only' },
];

// datetime-local wants "YYYY-MM-DDTHH:mm"; trim a stored ISO string to that.
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : '';
}

export function SurveyForm({ jobId, survey }: { jobId: string; survey?: SurveyRow }) {
  const action = survey ? updateSurvey : createSurvey;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {survey ? (
        <>
          <input type="hidden" name="id" value={survey.id} />
          <input type="hidden" name="version" value={survey.version} />
        </>
      ) : (
        <input type="hidden" name="job_id" value={jobId} />
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Survey type *</span>
        <select
          name="survey_type"
          defaultValue={survey?.survey_type ?? 'in_person'}
          className="rounded-md border bg-transparent px-3 py-2"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Scheduled for</span>
        <input
          type="datetime-local"
          name="scheduled_at"
          defaultValue={toLocalInput(survey?.scheduled_at ?? null)}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Cubic ft estimate</span>
          <input
            type="number"
            step="any"
            min={0}
            name="cubic_ft_estimate"
            defaultValue={survey?.cubic_ft_estimate ?? ''}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Confidence</span>
          <select
            name="cubic_ft_confidence"
            defaultValue={survey?.cubic_ft_confidence ?? ''}
            className="rounded-md border bg-transparent px-3 py-2"
          >
            <option value="">—</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>Complications (one per line)</span>
        <textarea
          name="complications"
          rows={2}
          defaultValue={(survey?.complications ?? []).join('\n')}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Internal notes (ops)</span>
        <textarea
          name="notes_internal"
          rows={3}
          defaultValue={survey?.notes_internal ?? ''}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Notes for the customer</span>
        <textarea
          name="notes_for_customer"
          rows={2}
          defaultValue={survey?.notes_for_customer ?? ''}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Source video URL</span>
        <input
          type="url"
          name="source_video_url"
          defaultValue={survey?.source_video_url ?? ''}
          placeholder="https://…"
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="completed"
          defaultChecked={Boolean(survey?.completed_at)}
          className="h-4 w-4"
        />
        Mark survey completed
      </label>

      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}
      {state.status === 'ok' ? (
        <p className="text-sm text-[var(--color-success,#16a34a)]">Saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? 'Saving…' : survey ? 'Save survey' : 'Create survey'}
      </button>
    </form>
  );
}
