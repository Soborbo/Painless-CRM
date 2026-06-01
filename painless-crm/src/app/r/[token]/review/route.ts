// Phase 11 §3/§4 — public review-link redirect. The review email points here
// (not straight to Google) so a click is recorded: it sets responded_at, which
// stops all further follow-ups (acceptance #5), then 302s to the company's
// Google "write a review" page. No auth — the token is the review_request id;
// the service-role client does the lookup. Compliance: this fires for every
// recipient identically, with no satisfaction branch.

import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK = 'https://www.google.com/search?q=Painless+Removals+Bristol+reviews';

function googleReviewUrl(placeId: string | null): string {
  return placeId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
    : FALLBACK;
}

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { token } = await params;
  if (!UUID_RE.test(token)) return NextResponse.redirect(FALLBACK, 302);

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from('review_requests')
    .select('id, company_id, google_review_link_clicked_at, responded_at')
    .eq('id', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (!row) return NextResponse.redirect(FALLBACK, 302);
  const req = row as {
    id: string;
    company_id: string;
    google_review_link_clicked_at: string | null;
    responded_at: string | null;
  };

  const now = new Date().toISOString();
  await supabase
    .from('review_requests')
    .update({
      google_review_link_clicked_at: req.google_review_link_clicked_at ?? now,
      responded_at: req.responded_at ?? now,
      status: 'clicked',
    })
    .eq('id', req.id);

  const { data: company } = await supabase
    .from('companies')
    .select('gmb_place_id')
    .eq('id', req.company_id)
    .maybeSingle();

  return NextResponse.redirect(
    googleReviewUrl((company as { gmb_place_id: string | null } | null)?.gmb_place_id ?? null),
    302,
  );
}

export const runtime = 'nodejs';
