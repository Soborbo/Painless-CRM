import { buildReviewEmail } from '@/lib/reviews/email';
import type { TemplateId } from '@/lib/reviews/engine/types';
import { describe, expect, it } from 'vitest';

const input = {
  customerName: 'Jane Smith',
  reviewUrl: 'https://crm.example/r/abc/review',
  complaintsUrl: 'https://crm.example/feedback/abc',
};

const TEMPLATES: TemplateId[] = ['nudge_1', 'nudge_2', 'nudge_3', 'nudge_4', 'post_click'];

describe('buildReviewEmail — universal, no gating (ADR-010 / ADR-047)', () => {
  it('always carries BOTH links, in every nudge stage', () => {
    for (const t of TEMPLATES) {
      const mail = buildReviewEmail(t, input);
      expect(mail.text).toContain(input.reviewUrl);
      expect(mail.text).toContain(input.complaintsUrl);
      expect(mail.html).toContain(input.reviewUrl);
      expect(mail.html).toContain(input.complaintsUrl);
    }
  });

  it('renders the two links with identical prominence (no button hierarchy)', () => {
    const { html } = buildReviewEmail('nudge_1', input);
    // Both CTAs go through the same paragraph + anchor renderer, so the wrapper
    // markup must appear exactly twice — neither link can outrank the other.
    const paragraphs = html.match(/<p style="margin:12px 0;font-size:16px;">/g) ?? [];
    expect(paragraphs).toHaveLength(2);
    const anchors = html.match(/style="color:#0066cc;text-decoration:underline;"/g) ?? [];
    expect(anchors).toHaveLength(2);
  });

  it('greets the customer by name', () => {
    expect(buildReviewEmail('nudge_1', input).text).toContain('Jane Smith');
  });
});
