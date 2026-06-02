// Phase 16 §2 — the bare-code portal URL is deprecated in favour of the
// HMAC-signed /partners/p/[token] link (a customer-facing referral code must
// not unlock an affiliate's earnings). This route no longer reads any data; it
// only tells the visitor to request a secure link.

export const dynamic = 'force-static';

export default function DeprecatedPartnerCodePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Partner portal</h1>
      <p className="rounded-md border px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
        This portal now uses a secure personal link. Please contact your Painless Removals
        representative for your up-to-date link.
      </p>
    </main>
  );
}
