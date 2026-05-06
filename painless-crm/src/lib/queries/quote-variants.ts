import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface QuoteVariantRow {
  id: string;
  quote_id: string;
  variant_label: string;
  total_pence: number;
  description: string | null;
  display_order: number;
}

const SELECT_COLUMNS = 'id, quote_id, variant_label, total_pence, description, display_order';

export async function listVariantsForQuote(quoteId: string): Promise<QuoteVariantRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('quote_variants')
    .select(SELECT_COLUMNS)
    .eq('quote_id', quoteId)
    .order('display_order', { ascending: true })
    .order('total_pence', { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

// Public surface — token-validated read using the admin client (caller MUST
// have already verified the share token). Returns the same shape so the
// public page renders the same way as the dashboard list.
export async function listPublicVariantsForQuote(quoteId: string): Promise<QuoteVariantRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('quote_variants')
    .select(SELECT_COLUMNS)
    .eq('quote_id', quoteId)
    .order('display_order', { ascending: true })
    .order('total_pence', { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

function flatten(raw: Record<string, unknown>): QuoteVariantRow {
  return {
    id: raw.id as string,
    quote_id: raw.quote_id as string,
    variant_label: raw.variant_label as string,
    total_pence: raw.total_pence as number,
    description: (raw.description as string | null) ?? null,
    display_order: (raw.display_order as number | null) ?? 0,
  };
}
