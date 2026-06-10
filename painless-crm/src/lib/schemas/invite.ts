import { z } from 'zod';

export const APP_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'sales',
  'surveyor',
  'loader',
  'accounts',
  'viewer',
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const INVITABLE_ROLES = APP_ROLES.filter((r) => r !== 'super_admin');

// Roles a worker can be invited with from their profile (they get into the
// worker PWA). Office-only roles stay on the Users settings invite flow.
export const WORKER_INVITE_ROLES = ['loader', 'surveyor'] as const;
export type WorkerInviteRole = (typeof WORKER_INVITE_ROLES)[number];

export const InviteWorkerSchema = z.object({
  worker_id: z.string().uuid(),
  role: z.enum(WORKER_INVITE_ROLES),
});
export type InviteWorkerInput = z.infer<typeof InviteWorkerSchema>;

export const InviteUserSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(APP_ROLES).refine((r) => r !== 'super_admin', {
    message: 'super_admin cannot be invited via UI',
  }),
});
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const AcceptInviteSchema = z
  .object({
    token: z.string().min(20).max(120),
    full_name: z.string().min(1).max(120),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
