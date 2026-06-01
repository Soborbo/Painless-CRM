import { createAdminClient } from '@/lib/supabase/admin';
import { FeedbackForm } from './feedback-form';

// Phase 11 §5 — public complaints form (no auth). The token is a review_request
// id; we only confirm it resolves before showing the form. Submitting a
// complaint also stops the review follow-ups.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ token: string }> };

async function tokenIsValid(token: string): Promise<boolean> {
  if (!UUID_RE.test(token)) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('review_requests')
    .select('id')
    .eq('id', token)
    .is('deleted_at', null)
    .maybeSingle();
  return Boolean(data);
}

export default async function FeedbackPage({ params }: Props) {
  const { token } = await params;
  const valid = await tokenIsValid(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Tell us what went wrong</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          We’re sorry your move didn’t go perfectly. Share the details below and we’ll get back to
          you within 24 hours.
        </p>
      </header>

      {valid ? (
        <FeedbackForm token={token} />
      ) : (
        <p className="rounded-md border px-4 py-3 text-sm">
          This feedback link is no longer valid. Please contact us directly and we’ll help straight
          away.
        </p>
      )}
    </main>
  );
}
