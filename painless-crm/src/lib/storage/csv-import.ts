import { StorageContainerSchema } from '@/lib/schemas/storage';

// Phase 24 — storage container CSV import. Pure: a hand-rolled RFC-4180 parser
// (the inverse of the export module's csvField) plus a validate-then-preview
// builder. No silent row drops — every rejected/duplicate row is reported so the
// office sees exactly what will and will not import. See ADR-033.

// Tokenise CSV text into a matrix. Handles quoted fields, doubled quotes,
// embedded commas/newlines, and CRLF or LF line endings.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function isBlank(row: readonly string[]): boolean {
  return row.every((c) => c.trim() === '');
}

export interface ParsedContainer {
  container_code: string;
  size_cubic_ft: number | null;
  monthly_rate_pence: number;
  status: string;
  notes: string | null;
}

export interface ImportRowError {
  line: number;
  message: string;
}

export interface ContainerImportResult {
  valid: ParsedContainer[];
  errors: ImportRowError[];
  duplicateCodes: string[]; // skipped: already at the site, or repeated in the file
  totalDataRows: number;
}

const HEADERS = ['container_code', 'size_cubic_ft', 'monthly_rate_pounds', 'status', 'notes'] as const;

function poundsToPence(raw: string): string {
  const trimmed = raw.trim();
  // 'NaN' so the schema rejects a blank rate rather than coercing '' to 0 — a
  // monthly rate is required (no silent default).
  if (trimmed === '') return 'NaN';
  const pounds = Number(trimmed);
  if (!Number.isFinite(pounds)) return trimmed; // let the schema reject it
  return String(Math.round(pounds * 100));
}

// Validate every data row against StorageContainerSchema; partition into
// importable rows, per-line errors, and skipped duplicates.
export function buildContainerImport(
  csvText: string,
  existingCodes: readonly string[],
): ContainerImportResult {
  const matrix = parseCsv(csvText).filter((r) => !isBlank(r));
  const empty: ContainerImportResult = { valid: [], errors: [], duplicateCodes: [], totalDataRows: 0 };
  if (matrix.length === 0) {
    return { ...empty, errors: [{ line: 0, message: 'The file is empty' }] };
  }

  const header = (matrix[0] as string[]).map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(HEADERS.map((h) => [h, header.indexOf(h)])) as Record<
    (typeof HEADERS)[number],
    number
  >;
  if (idx.container_code < 0) {
    return { ...empty, errors: [{ line: 1, message: 'Missing required column: container_code' }] };
  }

  const seen = new Set(existingCodes.map((c) => c.toUpperCase()));
  const result: ContainerImportResult = { valid: [], errors: [], duplicateCodes: [], totalDataRows: 0 };

  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r] as string[];
    const line = r + 1; // 1-based CSV line, header is line 1
    result.totalDataRows += 1;
    const cell = (i: number) => (i >= 0 ? (cells[i]?.trim() ?? '') : '');

    const parsed = StorageContainerSchema.safeParse({
      container_code: cell(idx.container_code),
      size_cubic_ft: cell(idx.size_cubic_ft),
      monthly_rate_pence: poundsToPence(cell(idx.monthly_rate_pounds)),
      status: cell(idx.status) || 'available',
      notes: cell(idx.notes),
    });
    if (!parsed.success) {
      result.errors.push({ line, message: parsed.error.issues[0]?.message ?? 'Invalid row' });
      continue;
    }

    const code = parsed.data.container_code; // schema upper-cases it
    if (seen.has(code)) {
      result.duplicateCodes.push(code);
      continue;
    }
    seen.add(code);
    result.valid.push({
      container_code: code,
      size_cubic_ft: parsed.data.size_cubic_ft ?? null,
      monthly_rate_pence: parsed.data.monthly_rate_pence,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    });
  }

  return result;
}
