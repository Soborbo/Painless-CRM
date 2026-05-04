import { runExcelSmokeTest } from '@/lib/integrations/excel/test';
import { runImageSmokeTest } from '@/lib/integrations/image/test';
import { runPdfSmokeTest } from '@/lib/integrations/pdf/test';
import { runRealtimeSmokeTest } from '@/lib/integrations/realtime/test';
import type { SmokeTestResult } from '@/lib/smoke/types';

export async function runAllSmokeTests(): Promise<SmokeTestResult[]> {
  const started = Date.now();
  const tests = [
    runPdfSmokeTest(),
    runImageSmokeTest(),
    runRealtimeSmokeTest(),
    runExcelSmokeTest(),
  ];
  const results = await Promise.all(tests);
  const totalMs = Date.now() - started;
  return results.map((r) => ({ ...r, durationMs: r.durationMs ?? totalMs }));
}
