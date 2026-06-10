import {
  MagicLinkSchema,
  RequestPasswordResetSchema,
  SetNewPasswordSchema,
  SignInSchema,
} from '@/lib/schemas/auth';
import {
  AcceptInviteSchema,
  INVITABLE_ROLES,
  InviteUserSchema,
  InviteWorkerSchema,
  WORKER_INVITE_ROLES,
} from '@/lib/schemas/invite';
import { describe, expect, it } from 'vitest';

describe('auth schemas', () => {
  it('SignInSchema requires email + min-8 password', () => {
    expect(SignInSchema.safeParse({ email: 'a@b.co', password: '12345678' }).success).toBe(true);
    expect(SignInSchema.safeParse({ email: 'a@b.co', password: '1234567' }).success).toBe(false);
    expect(SignInSchema.safeParse({ email: 'not-email', password: '12345678' }).success).toBe(
      false,
    );
  });

  it('MagicLinkSchema accepts valid email only', () => {
    expect(MagicLinkSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
    expect(MagicLinkSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('RequestPasswordResetSchema accepts valid email only', () => {
    expect(RequestPasswordResetSchema.safeParse({ email: 'x@y.co' }).success).toBe(true);
    expect(RequestPasswordResetSchema.safeParse({ email: 'no' }).success).toBe(false);
  });

  it('SetNewPasswordSchema requires confirmation match', () => {
    expect(
      SetNewPasswordSchema.safeParse({ password: 'abcd1234', confirmPassword: 'abcd1234' }).success,
    ).toBe(true);
    expect(
      SetNewPasswordSchema.safeParse({ password: 'abcd1234', confirmPassword: 'differ12' }).success,
    ).toBe(false);
  });
});

describe('invite schemas', () => {
  it('rejects super_admin role on invite', () => {
    const result = InviteUserSchema.safeParse({ email: 'x@y.co', role: 'super_admin' });
    expect(result.success).toBe(false);
  });

  it('accepts valid roles in INVITABLE_ROLES', () => {
    for (const role of INVITABLE_ROLES) {
      const result = InviteUserSchema.safeParse({ email: 'x@y.co', role });
      expect(result.success).toBe(true);
    }
  });

  it('AcceptInviteSchema requires matching passwords and full_name', () => {
    const base = {
      token: 'a'.repeat(64),
      full_name: 'Jane Doe',
      password: 'abcd1234',
      confirmPassword: 'abcd1234',
    };
    expect(AcceptInviteSchema.safeParse(base).success).toBe(true);
    expect(AcceptInviteSchema.safeParse({ ...base, confirmPassword: 'differ12' }).success).toBe(
      false,
    );
    expect(AcceptInviteSchema.safeParse({ ...base, full_name: '' }).success).toBe(false);
    expect(AcceptInviteSchema.safeParse({ ...base, token: 'short' }).success).toBe(false);
  });
});

describe('worker invite schema', () => {
  const workerId = '00000000-0000-0000-0000-0000000000aa';

  it('accepts only loader/surveyor with a uuid worker_id', () => {
    for (const role of WORKER_INVITE_ROLES) {
      expect(InviteWorkerSchema.safeParse({ worker_id: workerId, role }).success).toBe(true);
    }
  });

  it('rejects non-worker roles', () => {
    for (const role of ['admin', 'manager', 'sales', 'accounts', 'viewer', 'super_admin']) {
      expect(InviteWorkerSchema.safeParse({ worker_id: workerId, role }).success).toBe(false);
    }
  });

  it('rejects a non-uuid worker_id', () => {
    expect(InviteWorkerSchema.safeParse({ worker_id: 'not-a-uuid', role: 'loader' }).success).toBe(
      false,
    );
  });
});
