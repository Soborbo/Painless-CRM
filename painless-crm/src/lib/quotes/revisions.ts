import { createAdminClient } from '@/lib/supabase/admin';

// When a revision quote is marked sent, the predecessor in the chain becomes
// stale: the customer's old share link must stop accepting. We flip the parent
// to `expired` if it was still in a non-terminal state. Terminal statuses
// (accepted, declined, expired) are left untouched — accepting an old quote
// after a revision was sent is a real-world ambiguity we don't want to
// silently rewrite, and `accepted` in particular is a contractual record.

export type SupersedablePredecessorStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | null
  | undefined;

export function shouldSupersede(parentStatus: SupersedablePredecessorStatus): boolean {
  return parentStatus === 'draft' || parentStatus === 'sent';
}

export interface SupersedeResult {
  predecessor_id: string;
  flipped: boolean;
  reason: 'not_found' | 'no_parent' | 'terminal_status' | 'flipped' | 'already_expired';
}

export async function supersedePredecessor(quoteId: string): Promise<SupersedeResult> {
  const supabase = createAdminClient();

  const { data: child } = await supabase
    .from('quotes')
    .select('id, revised_from_id')
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!child) return { predecessor_id: '', flipped: false, reason: 'not_found' };
  const parentId = (child.revised_from_id as string | null) ?? null;
  if (!parentId) return { predecessor_id: '', flipped: false, reason: 'no_parent' };

  const { data: parent } = await supabase
    .from('quotes')
    .select('id, status')
    .eq('id', parentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!parent) return { predecessor_id: parentId, flipped: false, reason: 'not_found' };

  const status = parent.status as SupersedablePredecessorStatus;
  if (!shouldSupersede(status)) {
    return {
      predecessor_id: parentId,
      flipped: false,
      reason: status === 'expired' ? 'already_expired' : 'terminal_status',
    };
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'expired' })
    .eq('id', parentId)
    .in('status', ['draft', 'sent']);
  if (error) return { predecessor_id: parentId, flipped: false, reason: 'terminal_status' };
  return { predecessor_id: parentId, flipped: true, reason: 'flipped' };
}
