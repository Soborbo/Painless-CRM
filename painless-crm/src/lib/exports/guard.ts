// Shared rate-limit guard for the CSV export routes.
//
// SECURITY_MODEL.md T4: a departing rep bulk-exporting the customer list is
// the threat. The mitigation is a per-user cap on export operations — 10 per
// hour, matching Phase 06b §8. Keyed by user so one rep hitting the limit
// never blocks a colleague. Degrades open when no KV is bound (see
// lib/kv/rate-limit.ts), so dev and tests are unaffected.

import { rateLimitCheck } from '@/lib/kv/rate-limit';
import { NextResponse } from 'next/server';

export const EXPORT_RATE_LIMIT = { windowSec: 3600, maxRequests: 10 } as const;

export type ExportResource = 'customers' | 'jobs' | 'profit';

// Returns a 429 Response when the caller is over their hourly export budget,
// or null when the export may proceed.
export async function enforceExportRateLimit(
  userId: string,
  resource: ExportResource,
): Promise<Response | null> {
  const result = await rateLimitCheck(`export:${resource}:${userId}`, EXPORT_RATE_LIMIT);
  if (result.ok) return null;

  return NextResponse.json(
    { error: 'rate_limited' },
    {
      status: 429,
      headers: {
        'retry-after': String(EXPORT_RATE_LIMIT.windowSec),
        'cache-control': 'no-store',
      },
    },
  );
}
