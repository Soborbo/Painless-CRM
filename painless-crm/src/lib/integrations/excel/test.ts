import type { SmokeTestResult } from '@/lib/smoke/types';

/**
 * Smoke test 4 — Excel export under Workers CPU limits.
 *
 * Production: generate a 1000-row workbook with SheetJS / ExcelJS, stream the
 * response, verify completion within the Workers CPU budget (30s) and that
 * the file opens without corruption.
 */
export async function runExcelSmokeTest(): Promise<SmokeTestResult> {
  return {
    name: 'excel',
    status: 'partial',
    note: 'Stub. Add SheetJS/ExcelJS, generate 1000 rows, assert file integrity.',
  };
}
