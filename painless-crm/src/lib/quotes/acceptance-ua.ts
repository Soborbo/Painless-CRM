// Pure helpers for the acceptance audit panel. The user-agent string captured
// on accept can be 500 chars of mostly-noise; the panel needs a short,
// human-friendly summary plus the full string on hover. Heuristics here
// recognise the common UA shapes we expect from removal-customer phones —
// anything else falls back to "Other browser" so the panel never lies.

const PATTERNS: ReadonlyArray<{ test: RegExp; label: string }> = [
  { test: /iPhone[^)]*OS\s+([\d_]+)/i, label: 'iPhone' },
  { test: /iPad[^)]*OS\s+([\d_]+)/i, label: 'iPad' },
  { test: /Android\s+([\d.]+)/i, label: 'Android' },
  { test: /Macintosh|Mac OS X/i, label: 'Mac' },
  { test: /Windows NT/i, label: 'Windows' },
];

export interface UserAgentSummary {
  device: string;
  short: string;
  full: string;
}

export function summariseUserAgent(raw: string | null): UserAgentSummary | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  for (const { test, label } of PATTERNS) {
    const match = trimmed.match(test);
    if (match) {
      const version = match[1] ? match[1].replace(/_/g, '.') : null;
      const short = version ? `${label} ${version}` : label;
      return { device: label, short, full: trimmed };
    }
  }
  return { device: 'Other', short: 'Other browser', full: trimmed };
}
