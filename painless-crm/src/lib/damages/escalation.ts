// Phase 16 §4 — damage-claim auto-escalation. Pure + tested. When an agreed
// payout exceeds a threshold it auto-escalates to admins. The threshold is a
// constant for now (per-company config deferred — see Phase 16 key decision).

export const DAMAGE_AUTO_ESCALATE_PENCE = 50_000; // £500

export function shouldAutoEscalate(
  payoutPence: number | null,
  alreadyEscalated: boolean,
  thresholdPence: number = DAMAGE_AUTO_ESCALATE_PENCE,
): boolean {
  if (alreadyEscalated) return false;
  if (payoutPence == null) return false;
  return payoutPence > thresholdPence;
}
