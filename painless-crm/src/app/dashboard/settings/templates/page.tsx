import { requireRole } from '@/lib/auth/require-role';
import { listEmailTemplates, listSmsTemplates } from '@/lib/queries/templates';
import Link from 'next/link';

const TEMPLATE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function TemplatesPage() {
  await requireRole(TEMPLATE_ROLES);
  const [emails, sms] = await Promise.all([listEmailTemplates(), listSmsTemplates()]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold">Message templates</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Reusable email and SMS templates with {'{{variable}}'} merge fields. Used by manual sends
        and the automation engine.
      </p>

      <Section
        title="Email"
        newHref="/dashboard/settings/templates/email/new"
        rows={emails.map((t) => ({
          id: t.id,
          href: `/dashboard/settings/templates/email/${t.id}`,
          primary: t.name,
          secondary: t.category ?? t.subject_template,
          active: t.active,
        }))}
      />
      <Section
        title="SMS"
        newHref="/dashboard/settings/templates/sms/new"
        rows={sms.map((t) => ({
          id: t.id,
          href: `/dashboard/settings/templates/sms/${t.id}`,
          primary: t.name,
          secondary: t.body_template.slice(0, 80),
          active: t.active,
        }))}
      />
    </main>
  );
}

function Section({
  title,
  newHref,
  rows,
}: {
  title: string;
  newHref: string;
  rows: { id: string; href: string; primary: string; secondary: string; active: boolean }[];
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={newHref}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        >
          New {title.toLowerCase()} template
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">None yet.</p>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-[var(--color-muted)]"
            >
              <span>
                <span className="font-medium">{r.primary}</span>
                <span className="ml-2 text-[var(--color-muted-foreground)]">{r.secondary}</span>
              </span>
              {!r.active ? (
                <span className="text-xs text-[var(--color-muted-foreground)]">inactive</span>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
