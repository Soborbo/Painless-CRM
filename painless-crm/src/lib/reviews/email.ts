// Phase 11 §3 — the single universal review-request email. It carries BOTH a
// Google review link AND a complaints/feedback link, rendered with identical
// prominence (same markup, no button hierarchy). Compliance: there is no
// branching by satisfaction here — every recipient gets this exact structure.
// See ADR-010 and Phase 11 §3/§4 + anti-patterns.

export type ReviewEmailVariant = 'initial' | 'followup1' | 'followup2';

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

const INTRO: Record<ReviewEmailVariant, { subject: string; opener: string }> = {
  initial: {
    subject: 'Thank you from Painless Removals',
    opener: 'Thank you for choosing Painless Removals — we hope your move went smoothly.',
  },
  followup1: {
    subject: 'Hope you’re settling in',
    opener:
      'Hope you’re settling into your new place! If you’ve got 30 seconds, we’d love to hear how it went.',
  },
  followup2: {
    subject: 'One last note from Painless Removals',
    opener: 'Just a final note — your feedback genuinely helps a small local team like ours.',
  },
};

// Both calls-to-action share this exact renderer, so neither can be more
// prominent than the other. (Compliance: equal prominence, no gating.)
function linkLine(label: string, url: string): string {
  return `<p style="margin:12px 0;font-size:16px;"><a href="${url}" style="color:#0066cc;text-decoration:underline;">${label}</a></p>`;
}

export function buildReviewRequestEmail(
  variant: ReviewEmailVariant,
  input: ReviewEmailInput,
): ReviewEmail {
  const { subject, opener } = INTRO[variant];
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
