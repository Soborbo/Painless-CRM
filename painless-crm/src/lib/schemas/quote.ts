import { z } from 'zod';

// Filters for the office-wide quotes list + CSV export (Phase 06b §8).
// `status` mirrors the quotes.status check constraint; the list and export
// share this schema so "what you see is what you export".

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QuoteListFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(QUOTE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type QuoteListFilters = z.infer<typeof QuoteListFiltersSchema>;

export const QUOTE_PAGE_SIZE = 50;
export const QUOTES_EXPORT_MAX = 10_000;
