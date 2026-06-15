// Pure formatting helpers for the jobs card grid (iMVE-parity list view).

export type JobAddressSummary = {
  job_id: string;
  role: 'from' | 'to' | 'via';
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  property_type: string | null;
  floor: number | null;
  has_lift: boolean | null;
};

/** "8 Bude Rd, Filton, BS34 7HN" — skips blank parts, dedupes city repeated in line1. */
export function addressLine(a: {
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
}): string {
  const parts = [a.line1, a.line2 ?? '', a.city, a.postcode]
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.join(', ');
}

/**
 * wa.me deep-link from a stored phone number. Accepts E.164 (+44…) or UK
 * national (07…); returns null when there aren't enough digits to be dialable.
 */
export function whatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `44${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}

/** Picks the first `from` / `to` entry for a job out of the bulk address map. */
export function pickMoveEndpoints(rows: JobAddressSummary[]): {
  from: JobAddressSummary | null;
  to: JobAddressSummary | null;
} {
  return {
    from: rows.find((r) => r.role === 'from') ?? null,
    to: rows.find((r) => r.role === 'to') ?? null,
  };
}
