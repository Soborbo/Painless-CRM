import { type NotificationInput, buildNotificationRow } from '@/lib/notifications/create';
import { describe, expect, it } from 'vitest';

function input(o: Partial<NotificationInput>): NotificationInput {
  return {
    companyId: 'co1',
    recipientUserId: 'u1',
    type: 'assignment',
    title: 'You were assigned a job',
    ...o,
  };
}

describe('buildNotificationRow', () => {
  it('maps the required fields and defaults priority + in-app channel', () => {
    const row = buildNotificationRow(input({}));
    expect(row).toMatchObject({
      company_id: 'co1',
      recipient_user_id: 'u1',
      type: 'assignment',
      title: 'You were assigned a job',
      priority: 'normal',
      delivered_channels: ['in_app'],
    });
  });

  it('omits optional fields when not supplied', () => {
    const row = buildNotificationRow(input({}));
    expect(row.body).toBeUndefined();
    expect(row.link_url).toBeUndefined();
    expect(row.related_entity_type).toBeUndefined();
    expect(row.related_entity_id).toBeUndefined();
  });

  it('passes through optional fields and an explicit priority', () => {
    const row = buildNotificationRow(
      input({
        type: 'mention',
        body: 'Tom mentioned you',
        linkUrl: '/dashboard/jobs/abc',
        relatedEntityType: 'job',
        relatedEntityId: 'abc',
        priority: 'high',
      }),
    );
    expect(row).toMatchObject({
      type: 'mention',
      body: 'Tom mentioned you',
      link_url: '/dashboard/jobs/abc',
      related_entity_type: 'job',
      related_entity_id: 'abc',
      priority: 'high',
    });
  });

  it('truncates an over-long title and body', () => {
    const row = buildNotificationRow(input({ title: 'x'.repeat(300), body: 'y'.repeat(800) }));
    expect(row.title?.length).toBe(200);
    expect(row.body?.length).toBe(500);
  });
});
