// Phase 11 §3 + ADR-047 — the universal review-request email, rendered per
// nudge stage. Every variant carries BOTH a Google review link AND a complaints
// link with identical prominence (same markup, no button hierarchy). Compliance:
// no branching by satisfaction anywhere here — every recipient gets this exact
// structure. See ADR-010. Pure renderer; the sweep adds the unsubscribe header.

import type { TemplateId } from '@/lib/reviews/engine/types';

export interface ReviewEmailInput {
  customerName: string;
  reviewUrl: string; // our /r/{token}/review redirect → Google
  complaintsUrl: string; // our /feedback/{token} public form
}

export interface ReviewEmail {
  subject: string;
  text: string;
  html: string;
}

const COPY: Record<TemplateId, { subject: string; opener: string }> = {
  nudge_1: {
    subject: 'Thank you from Painless Removals',
    opener: 'Thank you for choosing Painless Removals — we hope your move went smoothly.',
  },
  nudge_2: {
    subject: 'How did your move go?',
    opener: "If you've got 30 seconds, we'd really value hearing how your move went.",
  },
  nudge_3: {
    subject: 'Hope you’re settling in',
    opener:
      'Hope you’re settling into your new place! A quick word about your move would mean a lot.',
  },
  nudge_4: {
    subject: 'One last note from Painless Removals',
    opener: 'Just a final note — your feedback genuinely helps a small local team like ours.',
  },
  post_click: {
    subject: 'Thanks for reviewing Painless Removals',
    opener:
      'Thank you for taking the time to review us — if you didn’t finish, the link below still works.',
  },
};

// Both calls-to-action share this exact renderer, so neither can be more
// prominent than the other (compliance: equal prominence, no gating).
function linkLine(label: string, url: string): string {
  return `<p style="margin:12px 0;font-size:16px;"><a href="${url}" style="color:#0066cc;text-decoration:underline;">${label}</a></p>`;
}

export function buildReviewEmail(template: TemplateId, input: ReviewEmailInput): ReviewEmail {
  const { subject, opener } = COPY[template];
  const greeting = `Hi ${input.customerName},`;
  const reviewLabel = 'Leave us a Google review';
  const complaintsLabel = 'Tell us if something didn’t go right';

  const text = [
    greeting,
    '',
    opener,
    '',
    `${reviewLabel}: ${input.reviewUrl}`,
    `${complaintsLabel}: ${input.complaintsUrl}`,
    '',
    'Thank you,',
    'The Painless Removals team',
  ].join('\n');

  const html = [
    `<p>${greeting}</p>`,
    `<p>${opener}</p>`,
    linkLine(reviewLabel, input.reviewUrl),
    linkLine(complaintsLabel, input.complaintsUrl),
    '<p>Thank you,<br/>The Painless Removals team</p>',
  ].join('\n');

  return { subject, text, html };
}
