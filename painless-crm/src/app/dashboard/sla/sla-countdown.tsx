'use client';

import { formatRemaining, isOverdue } from '@/lib/jobs/sla-remaining';
import { useEffect, useState } from 'react';

// Live "time remaining" cell for the SLA queue (Phase 06b §1).
// Ticks every 30s so the board left open on an office screen counts down on
// its own, and flips to the overdue tone the moment the deadline passes —
// no refresh needed. The server passes its own `now` so the first paint
// already matches the rest of the page; hydration then takes over the clock.

const TICK_MS = 30_000;

export function SlaCountdown({
  dueAtMs,
  serverNowMs,
  baseTone,
}: {
  dueAtMs: number;
  serverNowMs: number;
  baseTone: string;
}) {
  const [nowMs, setNowMs] = useState(serverNowMs);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const tone = isOverdue(dueAtMs, nowMs) ? 'text-red-700' : baseTone;

  return (
    <span className={`tabular-nums ${tone}`} suppressHydrationWarning>
      {formatRemaining(dueAtMs, nowMs)}
    </span>
  );
}
