import { z } from 'zod';

export const SignInSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});
export type SignInInput = z.infer<typeof SignInSchema>;

export const MagicLinkSchema = z.object({
  email: z.string().email().max(254),
});
export type MagicLinkInput = z.infer<typeof MagicLinkSchema>;

export const RequestPasswordResetSchema = z.object({
  email: z.string().email().max(254),
});
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;

export const SetNewPasswordSchema = z
  .object({
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type SetNewPasswordInput = z.infer<typeof SetNewPasswordSchema>;
