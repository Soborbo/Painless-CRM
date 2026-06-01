'use client';

import { type TemplateActionState, saveSmsTemplate } from '@/lib/actions/templates';
import { extractVariables, renderTemplate } from '@/lib/comms/render';
import type { SmsTemplateRow } from '@/lib/queries/templates';
import { useActionState, useState } from 'react';

const INITIAL: TemplateActionState = { status: 'idle' };

function preview(text: string): string {
  const vars = extractVariables(text);
  return renderTemplate(text, Object.fromEntries(vars.map((v) => [v, `«${v}»`])));
}

export function SmsTemplateForm({ template }: { template?: SmsTemplateRow }) {
  const [state, action, pending] = useActionState(saveSmsTemplate, INITIAL);
  const [body, setBody] = useState(template?.body_template ?? '');
  const rendered = preview(body);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}

      <label className="flex flex-col gap-1 text-sm">
        <span>Name *</span>
        <input
          name="name"
          defaultValue={template?.name ?? ''}
          required
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Body * — use {'{{variable}}'} placeholders</span>
        <textarea
          name="body_template"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          required
          className="rounded-md border px-3 py-2 font-mono text-xs"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={template?.active ?? true}
          className="h-4 w-4"
        />
        Active
      </label>

      <section className="rounded-md border bg-[var(--color-muted)]/30 p-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Preview
        </p>
        <p className="mt-1 whitespace-pre-wrap">{rendered || '—'}</p>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          {rendered.length} characters
        </p>
      </section>

      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save template'}
      </button>
    </form>
  );
}
