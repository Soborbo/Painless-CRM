import { verifyPartnerToken } from '@/lib/affiliates/portal-tokens';
import { serverEnv } from '@/lib/env';
import { getPartnerPortalByAffiliateId } from '@/lib/queries/partner-portal';
import { formatDate, formatPence } from '@/lib/utils/format';

// Phase 16 §2 — secure affiliate portal. The [token] is an HMAC-signed partner
// link (lib/affiliates/portal-tokens); only a link minted with the server
// secret resolves, so — unlike the bare referral code — a customer-facing code
// can't be used to read an affiliate's earnings. Read-only, no customer PII.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

function InvalidLink() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Partner portal</h1>
      <p className="rounded-md border px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
        This link is invalid or has expired. Please contact us for an up-to-date link.
      </p>
    </main>
  );
}

export default async function PartnerPortalTokenPage({ params }: Props) {
  const { token } = await params;
  const secret = serverEnv().QUOTE_LINK_SECRET ?? '';
  const verified = await verifyPartnerToken(token, secret);
  if (!verified.ok) return <InvalidLink />;

  const data = await getPartnerPortalByAffiliateId(verified.affiliateId);
  if (!data) return <InvalidLink />;

  const pending = data.totalsByStatus.pending ?? 0;
  const approved = data.totalsByStatus.approved ?? 0;
  const paid = data.totalsByStatus.paid ?? 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
          Painless Removals · Partner portal
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.affiliateName}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Your referral commissions with Painless Removals.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label="Awaiting approval" value={formatPence(pending)} />
        <Tile label="Approved (due)" value={formatPence(approved)} />
        <Tile label="Paid to date" value={formatPence(paid)} />
      </section>

      <section className="overflow-x-auto rounded-md border">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Commission history
          </h2>
        </header>
        {data.rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No commissions yet — referrals appear here once a job completes.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">{c.jobNumber != null ? `#${c.jobNumber}` : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPence(c.amountPence)}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[c.status] ?? c.status}</td>
                  <td className="px-4 py-2">{formatDate(c.paidAt ?? c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="text-xs text-[var(--color-muted-foreground)]">
        Questions about a payment? Reply to your usual Painless Removals contact.
      </footer>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
