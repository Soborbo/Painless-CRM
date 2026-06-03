// CSV serializer for the jobs list export.
// Phase 06b §8. RLS keeps the input rows tenant-scoped; this layer only
// shapes them into a flat, accountant-friendly grid with the same
// columns the office sees on screen, plus a few enrichments (assignee
// name, customer display, tag list) so the file is self-explanatory.
//
// Escaping follows RFC 4180: any value containing ',', '"', '\r' or
// '\n' is wrapped in double quotes and embedded quotes are doubled.

import { customerDisplayName } from '@/lib/utils/format';

export interface ExportableJob {
  job_number: string;
  stage: string;
  acquisition_source: string | null;
  move_date: string | null;
  enquiry_at: string | null;
  accepted_at: string | null;
  quote_total_pence: number | null;
  first_response_due_at: string | null;
  first_response_at: string | null;
  notes: string | null;
  created_at: string;
  customer: {
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    primary_email: string | null;
  } | null;
  assigned_to: { full_name: string } | null;
  tags: string[];
}

export const JOBS_CSV_HEADER = [
  'job_number',
  'stage',
  'customer',
  'customer_email',
  'assigned_to',
  'acquisition_source',
  'tags',
  'move_date',
  'enquiry_at',
  'accepted_at',
  'first_response_due_at',
  'first_response_at',
  'quote_total_pence',
  'notes',
  'created_at',
] as const;

const NEEDS_QUOTING = /[",\r\n]/;
// Spreadsheet (CSV) formula injection: Excel/Sheets execute a TEXT cell that
// begins with one of these as a formula (e.g. =HYPERLINK(...), +, -, @, or a
// leading tab/CR). User-controlled fields (customer names, notes, tags) flow
// straight into exports, so neutralise such values with a leading apostrophe
// per OWASP. Numbers are never formulas, so we only guard string values — this
// avoids mangling legitimate negative numbers like "-500".
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    const num = String(value);
    return NEEDS_QUOTING.test(num) ? `"${num.replace(/"/g, '""')}"` : num;
  }
  const str = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (!NEEDS_QUOTING.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function isoOrEmpty(value: string | null | undefined): string {
  return value ?? '';
}

function jobToRow(job: ExportableJob): string {
  return [
    csvField(job.job_number),
    csvField(job.stage),
    csvField(job.customer ? customerDisplayName(job.customer) : ''),
    csvField(job.customer?.primary_email ?? ''),
    csvField(job.assigned_to?.full_name ?? ''),
    csvField(job.acquisition_source ?? ''),
    csvField(job.tags.join('; ')),
    csvField(isoOrEmpty(job.move_date)),
    csvField(isoOrEmpty(job.enquiry_at)),
    csvField(isoOrEmpty(job.accepted_at)),
    csvField(isoOrEmpty(job.first_response_due_at)),
    csvField(isoOrEmpty(job.first_response_at)),
    csvField(job.quote_total_pence),
    csvField(job.notes ?? ''),
    csvField(job.created_at),
  ].join(',');
}

export function serializeJobsToCsv(jobs: readonly ExportableJob[]): string {
  const header = JOBS_CSV_HEADER.join(',');
  const body = jobs.map(jobToRow).join('\r\n');
  if (body.length === 0) return `${header}\r\n`;
  return `${header}\r\n${body}\r\n`;
}

export function exportFilename(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `jobs-${yyyy}-${mm}-${dd}.csv`;
}
