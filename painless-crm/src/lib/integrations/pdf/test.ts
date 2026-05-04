import type { SmokeTestResult } from '@/lib/smoke/types';

/**
 * Smoke test 1 — PDF generation on Cloudflare Workers.
 *
 * Production: use Cloudflare Browser Rendering binding (`env.BROWSER`) to
 * render an HTML doc to PDF. Until the binding is wired in wrangler.toml,
 * this stub returns `partial` so the gate is visibly incomplete.
 */
export async function runPdfSmokeTest(): Promise<SmokeTestResult> {
  return {
    name: 'pdf',
    status: 'partial',
    note: 'Stub. Wire Browser Rendering binding (env.BROWSER) and verify %PDF- magic + bytes > 0.',
  };
}
