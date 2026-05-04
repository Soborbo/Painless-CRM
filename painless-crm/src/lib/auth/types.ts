import type { AppRole } from '@/lib/schemas/invite';

export type AuthedUserProfile = {
  id: string;
  auth_id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: AppRole;
  active: boolean;
};

export type ClientUserSummary = Pick<
  AuthedUserProfile,
  'id' | 'company_id' | 'email' | 'full_name' | 'role'
>;
