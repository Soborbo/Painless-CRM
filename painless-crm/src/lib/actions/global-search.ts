'use server';

import { requireUser } from '@/lib/auth/require-role';
import { type GlobalSearchResults, runGlobalSearch } from '@/lib/queries/global-search';
import { z } from 'zod';

// Phase 06b §3. Thin Server Action wrapper around `runGlobalSearch`
// so the client component can call it from an input handler without
// putting the query in the URL (PII rule from CLAUDE.md).

const InputSchema = z.object({ q: z.string().max(100) });

export async function globalSearch(query: string): Promise<GlobalSearchResults> {
  await requireUser();
  const parsed = InputSchema.safeParse({ q: query });
  if (!parsed.success) return { customers: [], jobs: [], quotes: [], query: '' };
  return runGlobalSearch(parsed.data.q);
}
