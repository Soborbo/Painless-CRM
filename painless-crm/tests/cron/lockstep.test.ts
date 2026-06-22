import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CRON_SCHEDULE } from '@/worker-cron/schedule';
import { describe, expect, it } from 'vitest';

// Lockstep guard: the cron expressions declared under [triggers] in wrangler.toml
// MUST each have a CRON_SCHEDULE mapping (the scheduled() handler dispatches by
// exact expression — an unmapped trigger fires but resolves to null and silently
// no-ops), and CRON_SCHEDULE must not carry orphan entries Cloudflare never fires.

function wranglerCrons(): string[] {
  const toml = readFileSync(fileURLToPath(new URL('../../wrangler.toml', import.meta.url)), 'utf8');
  const block = toml.match(/crons\s*=\s*\[([\s\S]*?)\]/);
  const inner = block?.[1] ?? '';
  const out: string[] = [];
  for (const line of inner.split('\n')) {
    // Strip the TOML comment first: inline `# ...` text can itself contain quoted
    // words (e.g. "immediate") that would otherwise look like cron expressions.
    const code = line.split('#')[0] ?? '';
    const m = code.match(/"([^"]+)"/);
    if (m?.[1]) out.push(m[1]);
  }
  return out;
}

describe('cron lockstep (wrangler.toml <-> CRON_SCHEDULE)', () => {
  const declared = wranglerCrons();

  it('parses the wrangler crontab (incl. the review-requests trigger)', () => {
    expect(declared.length).toBeGreaterThan(0);
    expect(declared).toContain('15 * * * *');
  });

  it('every wrangler cron has a CRON_SCHEDULE entry (no silent no-op)', () => {
    expect(declared.filter((c) => !(c in CRON_SCHEDULE))).toEqual([]);
  });

  it('every CRON_SCHEDULE entry is declared in wrangler.toml (no orphan)', () => {
    const set = new Set(declared);
    expect(Object.keys(CRON_SCHEDULE).filter((c) => !set.has(c))).toEqual([]);
  });
});
