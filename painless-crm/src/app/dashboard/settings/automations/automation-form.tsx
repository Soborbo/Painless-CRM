'use client';

import { type AutomationRuleActionState, saveAutomationRule } from '@/lib/actions/automation-rules';
import { JOB_STAGES } from '@/lib/jobs/state-machine';
import type { AutomationRuleRow } from '@/lib/queries/automation-rules';
import { useActionState } from 'react';

const INITIAL: AutomationRuleActionState = { status: 'idle' };

export function AutomationForm({
  rule,
  templates,
}: {
  rule?: AutomationRuleRow;
  templates: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveAutomationRule, INITIAL);

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}

      <label className="flex flex-col gap-1 text-sm">
        <span>Name *</span>
        <input
          name="name"
          defaultValue={rule?.name ?? ''}
          required
          className="rounded-md border px-3 py-2"
        />
      </label>

      <p className="text-sm text-[var(--color-muted-foreground)]">
        When a job moves between these stages (blank = any), send the chosen email template after
        the delay.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>From stage</span>
          <select
            name="from_stage"
            defaultValue={rule?.from_stage ?? ''}
            className="rounded-md border bg-transparent px-3 py-2"
          >
            <option value="">Any</option>
            {JOB_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>To stage</span>
          <select
            name="to_stage"
            defaultValue={rule?.to_stage ?? ''}
            className="rounded-md border bg-transparent px-3 py-2"
          >
            <option value="">Any</option>
            {JOB_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>Delay (minutes)</span>
        <input
          name="delay_minutes"
          type="number"
          min={0}
          defaultValue={rule ? Math.round(rule.delay_seconds / 60) : 0}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Email template *</span>
        <select
          name="template_id"
          defaultValue={rule?.template_id ?? ''}
          required
          className="rounded-md border bg-transparent px-3 py-2"
        >
          <option value="" disabled>
            Select a template
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={rule?.active ?? true}
          className="h-4 w-4"
        />
        Active
      </label>

      {templates.length === 0 ? (
        <p className="text-sm text-[var(--color-danger,#dc2626)]">
          Create an email template first.
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || templates.length === 0}
        className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save rule'}
      </button>
    </form>
  );
}
