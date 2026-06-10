import { z } from 'zod';

// Phase 25b — customer-facing document copy as config-as-data (ADR-034). Stored
// on settings.document_text; resolved with safe empty defaults so a surface
// renders the block only when the tenant has set text. No PDF render here — the
// copy flows into existing HTML surfaces (acceptance page, sign-off).

export interface DocumentText {
  acceptance_terms: string;
  signoff_declaration: string;
  quote_footer: string;
}

export const DOCUMENT_TEXT_KEYS = [
  'acceptance_terms',
  'signoff_declaration',
  'quote_footer',
] as const;

const MAX = 8000;

export const DocumentTextSchema = z.object({
  acceptance_terms: z.string().trim().max(MAX),
  signoff_declaration: z.string().trim().max(MAX),
  quote_footer: z.string().trim().max(MAX),
});

export function resolveDocumentText(raw: unknown): DocumentText {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const pick = (k: (typeof DOCUMENT_TEXT_KEYS)[number]) =>
    typeof o[k] === 'string' ? (o[k] as string) : '';
  return {
    acceptance_terms: pick('acceptance_terms'),
    signoff_declaration: pick('signoff_declaration'),
    quote_footer: pick('quote_footer'),
  };
}
