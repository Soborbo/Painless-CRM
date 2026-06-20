// Customer 360 §Merge — duplicate detection. Pure clustering that groups the
// customer base by shared contact details so the office can spot duplicates
// created by different channels (web form, phone, import). Two customers land in
// the same cluster when they share a normalised email OR phone; the relation is
// transitive (A↔B by email, B↔C by phone ⇒ {A,B,C}), resolved with union-find.
//
// This is the safe, non-destructive half of the merge tool: it surfaces
// candidates for a human to review. The actual record merge (re-pointing jobs,
// quotes, invoices …) is a transactional DB operation handled separately.

import type { CustomerType } from '@/lib/schemas/customer';

export interface DedupCustomer {
  id: string;
  customer_type: CustomerType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  created_at: string;
}

export type MatchSignal = 'email' | 'phone';

export interface DuplicateCluster {
  /** Stable id for the cluster — the earliest-created member's id. */
  id: string;
  /** Which shared detail(s) put these records together. */
  matchedOn: MatchSignal[];
  /** Members, oldest first (the likely record to keep). */
  customers: DedupCustomer[];
}

// Lowercased, trimmed email, or null when there's nothing usable to key on.
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  return e.includes('@') ? e : null;
}

// Digits-only national number: drops a UK country code (44) and the trunk 0 so
// "+44 7911 123456", "07911 123456" and "447911123456" all key the same. Too-
// short fragments return null rather than over-matching.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('44')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  return d.length >= 6 ? d : null;
}

export function findDuplicateClusters(customers: readonly DedupCustomer[]): DuplicateCluster[] {
  const n = customers.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  // Indices are always in-bounds (0..n-1), so the reads can't be undefined.
  const at = (idx: number): number => parent[idx] as number;
  function find(i: number): number {
    let root = i;
    while (at(root) !== root) root = at(root);
    // Path compression keeps repeated lookups flat.
    let node = i;
    while (at(node) !== root) {
      const next = at(node);
      parent[node] = root;
      node = next;
    }
    return root;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }

  // Link every customer that shares a normalised key with an earlier one.
  const firstByEmail = new Map<string, number>();
  const firstByPhone = new Map<string, number>();
  customers.forEach((c, i) => {
    const email = normalizeEmail(c.primary_email);
    if (email) {
      const seen = firstByEmail.get(email);
      if (seen === undefined) firstByEmail.set(email, i);
      else union(seen, i);
    }
    const phone = normalizePhone(c.primary_phone);
    if (phone) {
      const seen = firstByPhone.get(phone);
      if (seen === undefined) firstByPhone.set(phone, i);
      else union(seen, i);
    }
  });

  // Gather members per root.
  const groups = new Map<number, DedupCustomer[]>();
  customers.forEach((c, i) => {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(c);
    groups.set(root, list);
  });

  const clusters: DuplicateCluster[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const ordered = [...members].sort((a, b) => a.created_at.localeCompare(b.created_at));
    clusters.push({
      id: ordered[0]?.id ?? '',
      matchedOn: signalsFor(ordered),
      customers: ordered,
    });
  }

  // Biggest, then oldest, clusters first — the ones most worth resolving.
  clusters.sort(
    (a, b) =>
      b.customers.length - a.customers.length ||
      (a.customers[0]?.created_at ?? '').localeCompare(b.customers[0]?.created_at ?? ''),
  );
  return clusters;
}

// A signal counts when at least two members share the same normalised value.
function signalsFor(members: readonly DedupCustomer[]): MatchSignal[] {
  const out: MatchSignal[] = [];
  if (hasSharedKey(members, (c) => normalizeEmail(c.primary_email))) out.push('email');
  if (hasSharedKey(members, (c) => normalizePhone(c.primary_phone))) out.push('phone');
  return out;
}

function hasSharedKey(
  members: readonly DedupCustomer[],
  keyOf: (c: DedupCustomer) => string | null,
): boolean {
  const counts = new Map<string, number>();
  for (const c of members) {
    const k = keyOf(c);
    if (!k) continue;
    const next = (counts.get(k) ?? 0) + 1;
    if (next >= 2) return true;
    counts.set(k, next);
  }
  return false;
}
