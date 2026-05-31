// CSV serializer for the office-wide quotes list export.
// Phase 06b §8. RLS keeps the input rows tenant-scoped; this layer only
// shapes them into a flat, accountant-friendly grid with the same columns
// the office sees on screen, plus the linked job number and customer display
// name so the file is self-explanatory.
//
// Escaping follows RFC 4180 via the shared csvField helper.

import { csvField } from '@/lib/exports/jobs-csv';
import type { QuoteListItem } from '@/lib/queries/quotes';
import { customerDisplayName } from '@/lib/utils/format';

export const QUOTES_CSV_HEADER = [
  'job_number',
  'customer',
  'customer_email',
  'status',
  'revision',
  'total_pence',
  'valid_until',
  'sent_at',
  'declined_at',
  'withdrawn_at',
  'open_count',
  'created_at',
] as const;

function quoteToRow(q: QuoteListItem): string {
  return [
    csvField(q.job_number),
    csvField(q.customer ? customerDisplayName(q.customer) : ''),
    csvField(q.customer?.primary_email ?? ''),
    csvField(q.status ?? ''),
    csvField(q.revision_number),
    csvField(q.total_pence),
    csvField(q.valid_until),
    csvField(q.sent_at ?? ''),
    csvField(q.declined_at ?? ''),
    csvField(q.withdrawn_at ?? ''),
    csvField(q.open_count),
    csvField(q.created_at),
  ].join(',');
}

export function serializeQuotesToCsv(quotes: readonly QuoteListItem[]): string {
  const header = QUOTES_CSV_HEADER.join(',');
  const body = quotes.map(quoteToRow).join('\r\n');
  if (body.length === 0) return `${header}\r\n`;
  return `${header}\r\n${body}\r\n`;
}

export function quotesExportFilename(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `quotes-${yyyy}-${mm}-${dd}.csv`;
}
