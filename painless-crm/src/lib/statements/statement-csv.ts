import { csvField } from '@/lib/exports/jobs-csv';
import type { Statement } from '@/lib/statements/statement';

// Phase 26 — CSV serializer for the account statement (RFC-4180 via csvField).

export const STATEMENT_CSV_HEADER = [
  'issued_at',
  'invoice_number',
  'type',
  'status',
  'total_pence',
  'amount_paid_pence',
  'amount_outstanding_pence',
  'running_outstanding_pence',
] as const;

export function serializeStatementToCsv(statement: Statement): string {
  const header = STATEMENT_CSV_HEADER.join(',');
  const body = statement.lines
    .map((l) =>
      [
        csvField(l.issued_at ?? ''),
        csvField(l.invoice_number),
        csvField(l.type ?? ''),
        csvField(l.status ?? ''),
        csvField(l.total_pence),
        csvField(l.amount_paid_pence),
        csvField(l.amount_outstanding_pence),
        csvField(l.running_outstanding_pence),
      ].join(','),
    )
    .join('\r\n');
  if (body.length === 0) return `${header}\r\n`;
  return `${header}\r\n${body}\r\n`;
}
