import { requireRole } from '@/lib/auth/require-role';
import { type RotaAssignment, getRotaDay } from '@/lib/queries/rota';
import { getBrandingByCompanyId } from '@/lib/queries/settings';
import { isValidYmd } from '@/lib/rota/dates';
import { resolveBranding } from '@/lib/settings/branding';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PrintButton } from '../print-button';

// Paper-clean crew sheet for the day. Unlike the interactive day view this
// drops every control (assign forms, remove buttons, nav) and renders a
// branded, print-first layout the office can hand to crews or "Save as PDF".

type Props = { params: Promise<{ date: string }> };

export const dynamic = 'force-dynamic';

const FULL_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function RotaPrintPage({ params }: Props) {
  const me = await requireRole(['manager', 'admin', 'super_admin']);
  const { date } = await params;
  if (!isValidYmd(date)) notFound();

  const [day, branding, t] = await Promise.all([
    getRotaDay(date),
    getBrandingByCompanyId(me.company_id).then((b) => resolveBranding(b)),
    getTranslations('rota'),
  ]);
  const heading = FULL_DATE.format(new Date(`${date}T00:00:00.000Z`));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-10 text-black print:px-0 print:py-0">
      <div className="h-0.5 w-full" style={{ backgroundColor: branding.brandColor }} aria-hidden />
      <header className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant logo URL, not a bundled asset
            <img src={branding.logoUrl} alt={branding.companyName} className="h-9 w-auto" />
          ) : (
            <span className="text-lg font-semibold">{branding.companyName}</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)] print:text-neutral-500">
            {t('crewSheet')}
          </p>
          <p className="text-lg font-semibold">{heading}</p>
        </div>
      </header>

      <PrintButton />

      {day.jobs.length === 0 ? (
        <p className="rounded-md border px-4 py-10 text-center text-sm">{t('noJobs')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {day.jobs.map((job) => {
            const assignments = day.assignmentsByJob.get(job.id) ?? [];
            return (
              <section
                key={job.id}
                className="break-inside-avoid rounded-md border print:rounded-none"
              >
                <div className="flex items-center justify-between gap-2 border-b bg-[var(--color-muted)]/40 px-4 py-2 print:bg-transparent">
                  <h2 className="font-medium">
                    {job.job_number} · {job.customer_name}
                  </h2>
                  <span className="text-xs text-[var(--color-muted-foreground)] print:text-neutral-500">
                    {t('assignedCount', { count: assignments.length })}
                  </span>
                </div>

                {assignments.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--color-muted-foreground)] print:text-neutral-500">
                    {t('noneAssigned')}
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase tracking-wide text-[var(--color-muted-foreground)] print:text-neutral-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">{t('worker')}</th>
                        <th className="px-4 py-2 font-medium">{t('role')}</th>
                        <th className="px-4 py-2 font-medium">{t('vehicle')}</th>
                        <th className="px-4 py-2 font-medium">{t('time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium">{a.worker_name}</td>
                          <td className="px-4 py-2">{a.role ? t(`roles.${a.role}`) : '—'}</td>
                          <td className="px-4 py-2">{a.vehicle_registration ?? '—'}</td>
                          <td className="px-4 py-2 tabular-nums">{timeWindow(a)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function timeWindow(a: RotaAssignment): string {
  const fmt = (s: string | null) => (s ? s.slice(0, 5) : null);
  const start = fmt(a.scheduled_start);
  const end = fmt(a.scheduled_end);
  if (start && end) return `${start}–${end}`;
  if (start) return `${start}–`;
  return '—';
}
