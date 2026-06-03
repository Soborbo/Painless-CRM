import { poundsToPence } from '@/lib/money/pounds';
import { StorageContainerSchema } from '@/lib/schemas/storage';

// Phase 24 — storage container CSV import. Pure: a hand-rolled RFC-4180 parser
// (the inverse of the export module's csvField) plus a validate-then-preview
// builder. No silent row drops — every rejected/duplicate row is reported so the
// office sees exactly what will and will not import. See ADR-033.

export interface CsvRow {
  cells: string[];
  /** 1-based PHYSICAL line where this row starts (counts blank + multi-line
   *  quoted rows), so error/duplicate reporting points at the real file line. */
  line: number;
}

// Tokenise CSV text into rows tagged with their physical start line. Handles
// quoted fields, doubled quotes, embedded commas/newlines, and CRLF or LF.
export function parseCsvRows(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let physLine = 1; // physical line currently being read
  let rowStartLine = 1; // physical line the in-progress row began on

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
      } else if (ch === '\n') {
        // A real newline inside a quoted field: keep it in the value, but it is
        // still a physical line for reporting purposes.
        field += '\n';
        physLine += 1;
      } else if (ch !== '\r') {
        // Drop a stray CR (CRLF inside quotes) so imported notes aren't garbled.
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      cells.push(field);
      field = '';
    } else if (ch === '\n') {
      cells.push(field);
      rows.push({ cells, line: rowStartLine });
      cells = [];
      field = '';
      physLine += 1;
      rowStartLine = physLine;
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || cells.length > 0) {
    cells.push(field);
    rows.push({ cells, line: rowStartLine });
  }
  return rows;
}

// Back-compat matrix view (drops the line tags).
export function parseCsv(text: string): string[][] {
  return parseCsvRows(text).map((r) => r.cells);
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

const HEADERS = [
  'container_code',
  'size_cubic_ft',
  'monthly_rate_pounds',
  'status',
  'notes',
] as const;

function rateStringToPence(raw: string): string {
  // 'NaN' so the schema rejects a blank/invalid rate rather than coercing to 0 —
  // a monthly rate is required (no silent default). poundsToPence is integer-safe
  // and rejects hex/scientific notation.
  const pence = poundsToPence(raw);
  return pence === null ? 'NaN' : String(pence);
}

// Validate every data row against StorageContainerSchema; partition into
// importable rows, per-line errors, and skipped duplicates.
export function buildContainerImport(
  csvText: string,
  existingCodes: readonly string[],
): ContainerImportResult {
  const matrix = parseCsvRows(csvText).filter((r) => !isBlank(r.cells));
  const empty: ContainerImportResult = {
    valid: [],
    errors: [],
    duplicateCodes: [],
    totalDataRows: 0,
  };
  if (matrix.length === 0) {
    return { ...empty, errors: [{ line: 0, message: 'The file is empty' }] };
  }

  const header = (matrix[0] as CsvRow).cells.map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(HEADERS.map((h) => [h, header.indexOf(h)])) as Record<
    (typeof HEADERS)[number],
    number
  >;
  if (idx.container_code < 0) {
    return { ...empty, errors: [{ line: 1, message: 'Missing required column: container_code' }] };
  }

  const seen = new Set(existingCodes.map((c) => c.toUpperCase()));
  const result: ContainerImportResult = {
    valid: [],
    errors: [],
    duplicateCodes: [],
    totalDataRows: 0,
  };

  for (let r = 1; r < matrix.length; r += 1) {
    const cells = (matrix[r] as CsvRow).cells;
    const line = (matrix[r] as CsvRow).line; // true physical line in the file
    result.totalDataRows += 1;
    const cell = (i: number) => (i >= 0 ? (cells[i]?.trim() ?? '') : '');

    const parsed = StorageContainerSchema.safeParse({
      container_code: cell(idx.container_code),
      size_cubic_ft: cell(idx.size_cubic_ft),
      monthly_rate_pence: rateStringToPence(cell(idx.monthly_rate_pounds)),
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
