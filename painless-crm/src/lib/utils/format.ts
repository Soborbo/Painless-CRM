const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export function formatPence(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return '—';
  return GBP.format(pence / 100);
}

// timeZone:'UTC' so a date-only DATE column (stored at UTC midnight) renders the
// same calendar day on any runtime — without it, a non-UTC host shows the prior
// day (audit, timezone). Matches the explicit UTC formatters used elsewhere
// (dispatch/calendar/rota). The codebase stores/compares dates in UTC.
const DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return DATE.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return DATE_TIME.format(typeof value === 'string' ? new Date(value) : value);
}

export function customerDisplayName(c: {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
}): string {
  if (c.customer_type === 'business' && c.company_name) return c.company_name;
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return name || c.primary_email || 'Unnamed customer';
}
