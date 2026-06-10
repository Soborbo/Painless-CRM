import type { CalendarAppointment } from '@/lib/calendar/grid';
import Link from 'next/link';

// Category → chip colour. Kept here so month + agenda views render consistently.
const CATEGORY_CLASS: Record<string, string> = {
  survey: 'bg-blue-100 text-blue-900',
  move: 'bg-emerald-100 text-emerald-900',
  callback: 'bg-amber-100 text-amber-900',
  meeting: 'bg-violet-100 text-violet-900',
  other: 'bg-zinc-100 text-zinc-700',
};

function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

function targetHref(a: CalendarAppointment): string | null {
  if (a.job_id) return `/dashboard/jobs/${a.job_id}`;
  if (a.customer_id) return `/dashboard/customers/${a.customer_id}`;
  return null;
}

export function AppointmentChip({
  appt,
  showTime = true,
}: { appt: CalendarAppointment; showTime?: boolean }) {
  const cls = CATEGORY_CLASS[appt.category] ?? CATEGORY_CLASS.other;
  const href = targetHref(appt);
  const body = (
    <span className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${cls}`} title={appt.title}>
      {showTime ? <span className="font-mono">{timeOf(appt.starts_at)} </span> : null}
      {appt.title}
    </span>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}
