'use client';

import { type AutomationRuleActionState, saveAutomationRule } from '@/lib/actions/automation-rules';
import {
  INVOICE_KINDS,
  TRIGGER_EVENTS,
  TRIGGER_EVENT_LABELS,
  type TriggerEvent,
} from '@/lib/comms/automation';
import { JOB_STAGES } from '@/lib/jobs/state-machine';
import type { AutomationRuleRow } from '@/lib/queries/automation-rules';
import { useActionState, useState } from 'react';

const INITIAL: AutomationRuleActionState = { status: 'idle' };
const SERVICE_TYPES = ['removal', 'waste_clearance', 'storage'] as const;
const labelStage = (s: string) => s.replace(/_/g, ' ');

export function AutomationForm({
  rule,
  templates,
}: {
  rule?: AutomationRuleRow;
  templates: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveAutomationRule, INITIAL);
  const [event, setEvent] = useState<TriggerEvent>(
    (rule?.trigger_event as TriggerEvent) ?? 'job.stage_changed',
  );
  const isStage = event === 'job.stage_changed';
  const isInvoiceOrPayment = event === 'invoice.created' || event === 'payment.recorded';
  const stageOptions = JOB_STAGES.map((s) => (
    <option key={s} value={s}>
      {labelStage(s)}
    </option>
  ));

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

      <label className="flex flex-col gap-1 text-sm">
        <span>When this happens *</span>
        <select
          name="trigger_event"
          value={event}
          onChange={(e) => setEvent(e.target.value as TriggerEvent)}
          className="rounded-md border bg-transparent px-3 py-2"
        >
          {TRIGGER_EVENTS.map((ev) => (
            <option key={ev} value={ev}>
              {TRIGGER_EVENT_LABELS[ev]}
            </option>
          ))}
        </select>
      </label>

      {isStage ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>From stage</span>
              <select
                name="from_stage"
                defaultValue={rule?.from_stage ?? ''}
                className="rounded-md border bg-transparent px-3 py-2"
              >
                <option value="">Any</option>
                {stageOptions}
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
                {stageOptions}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span>Only for service type</span>
            <select
              name="service_type"
              defaultValue={rule?.service_type ?? ''}
              className="rounded-md border bg-transparent px-3 py-2"
            >
              <option value="">Any</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {labelStage(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Only send if still in stage (auto-cancel follow-ups)</span>
            <select
              name="requires_stage"
              defaultValue={rule?.requires_stage ?? ''}
              className="rounded-md border bg-transparent px-3 py-2"
            >
              <option value="">Always send</option>
              {stageOptions}
            </select>
          </label>
        </>
      ) : null}

      {isInvoiceOrPayment ? (
        <label className="flex flex-col gap-1 text-sm">
          <span>Only for invoice type</span>
          <select
            name="kind"
            defaultValue={rule?.kind ?? ''}
            className="rounded-md border bg-transparent px-3 py-2"
          >
            <option value="">Any</option>
            {INVOICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {labelStage(k)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
