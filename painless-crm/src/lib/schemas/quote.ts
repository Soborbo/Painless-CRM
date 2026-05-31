import { z } from 'zod';
import { optionalDateFilter } from './common';

// Filters for the office-wide quotes list + CSV export (Phase 06b §8).
// `status` mirrors the quotes.status check constraint; the list and export
// share this schema so "what you see is what you export".

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QuoteListFiltersSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(QUOTE_STATUSES).optional(),
    // Phase 06b §8 — bound the created window for filtered quote exports.
    created_from: optionalDateFilter,
    created_to: optionalDateFilter,
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((v) => !v.created_from || !v.created_to || v.created_from <= v.created_to, {
    message: 'created_from must not be after created_to',
    path: ['created_to'],
  });
export type QuoteListFilters = z.infer<typeof QuoteListFiltersSchema>;

export const QUOTE_PAGE_SIZE = 50;
export const QUOTES_EXPORT_MAX = 10_000;
