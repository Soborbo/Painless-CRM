// Phase 11 §6 — damage-claim state machine. Pure so the action and any future
// cron share one source of truth. Damages are tracked separately from
// complaints (a claim may or may not arise from a complaint).
//
// Statuses (mirrors the SQL check on damage_claims.status):
//   reported     — logged, not yet assessed
//   investigating — being assessed (may involve the insurer)
//   agreed       — liability accepted, payout to be made
//   paid         — payout settled (terminal)
//   denied       — claim rejected (terminal)

export type DamageStatus = 'reported' | 'investigating' | 'agreed' | 'paid' | 'denied';

const ALLOWED: Record<DamageStatus, DamageStatus[]> = {
  reported: ['investigating', 'denied'],
  investigating: ['agreed', 'denied'],
  agreed: ['paid', 'denied'],
  paid: [],
  denied: [],
};

export function canTransition(from: DamageStatus, to: DamageStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

// `paid` and `denied` close the claim.
export function isTerminal(status: DamageStatus): boolean {
  return status === 'paid' || status === 'denied';
}
