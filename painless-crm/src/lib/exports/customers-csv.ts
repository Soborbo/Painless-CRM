// CSV serializer for the customers list export.
// Phase 06b §8. RLS keeps the input rows tenant-scoped; this layer only
// shapes them into a flat, accountant-friendly grid with the same
// columns the office sees on screen, plus the display name so the file
// is self-explanatory.
//
// Escaping follows RFC 4180: any value containing ',', '"', '\r' or
// '\n' is wrapped in double quotes and embedded quotes are doubled.

import { csvField } from '@/lib/exports/jobs-csv';
import { customerDisplayName } from '@/lib/utils/format';

export interface ExportableCustomer {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  acquisition_source: string | null;
  created_at: string;
}

export const CUSTOMERS_CSV_HEADER = [
  'name',
  'customer_type',
  'first_name',
  'last_name',
  'company_name',
  'email',
  'phone',
  'acquisition_source',
  'created_at',
] as const;

function customerToRow(c: ExportableCustomer): string {
  return [
    csvField(customerDisplayName(c)),
    csvField(c.customer_type),
    csvField(c.first_name ?? ''),
    csvField(c.last_name ?? ''),
    csvField(c.company_name ?? ''),
    csvField(c.primary_email ?? ''),
    csvField(c.primary_phone ?? ''),
    csvField(c.acquisition_source ?? ''),
    csvField(c.created_at),
  ].join(',');
}

export function serializeCustomersToCsv(customers: readonly ExportableCustomer[]): string {
  const header = CUSTOMERS_CSV_HEADER.join(',');
  const body = customers.map(customerToRow).join('\r\n');
  if (body.length === 0) return `${header}\r\n`;
  return `${header}\r\n${body}\r\n`;
}

export function customersExportFilename(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `customers-${yyyy}-${mm}-${dd}.csv`;
}
