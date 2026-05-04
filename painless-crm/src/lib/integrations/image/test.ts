import type { SmokeTestResult } from '@/lib/smoke/types';

/**
 * Smoke test 2 — image processing on Cloudflare Workers.
 *
 * Production: upload a 4MB JPEG to Supabase Storage, transform via Cloudflare
 * Images binding to 800x600 WebP, assert output < 200kb.
 */
export async function runImageSmokeTest(): Promise<SmokeTestResult> {
  return {
    name: 'image',
    status: 'partial',
    note: 'Stub. Wire Cloudflare Images binding + Supabase Storage round trip.',
  };
}
