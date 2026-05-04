import { afterEach, describe, expect, it, vi } from 'vitest';

const navigationMock = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(public to: string) {
      super(`NEXT_REDIRECT:${to}`);
    }
  }
  return {
    Redirect,
    redirect: vi.fn((to: string) => {
      throw new Redirect(to);
    }),
  };
});

vi.mock('next/navigation', () => ({
  redirect: navigationMock.redirect,
}));

const supabaseMock = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: supabaseMock.createClient,
}));

type Profile = {
  id: string;
  auth_id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
};

function buildClient(opts: { user: { id: string } | null; profile: Profile | null }) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: opts.profile })),
        })),
      })),
    })),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('requireUser / requireRole', () => {
  it('redirects to /login when unauthenticated', async () => {
    supabaseMock.createClient.mockResolvedValueOnce(buildClient({ user: null, profile: null }));
    const { requireUser } = await import('@/lib/auth/require-role');
    await expect(requireUser()).rejects.toMatchObject({ to: '/login' });
  });

  it('redirects to /login when profile missing', async () => {
    supabaseMock.createClient.mockResolvedValueOnce(
      buildClient({ user: { id: 'auth-1' }, profile: null }),
    );
    const { requireUser } = await import('@/lib/auth/require-role');
    await expect(requireUser()).rejects.toMatchObject({ to: '/login' });
  });

  it('redirects to /login when profile is inactive', async () => {
    supabaseMock.createClient.mockResolvedValueOnce(
      buildClient({
        user: { id: 'auth-1' },
        profile: {
          id: 'u1',
          auth_id: 'auth-1',
          company_id: 'c1',
          email: 'a@b.co',
          full_name: 'A',
          role: 'sales',
          active: false,
        },
      }),
    );
    const { requireUser } = await import('@/lib/auth/require-role');
    await expect(requireUser()).rejects.toMatchObject({ to: '/login' });
  });

  it('returns the profile when authenticated and active', async () => {
    const profile: Profile = {
      id: 'u1',
      auth_id: 'auth-1',
      company_id: 'c1',
      email: 'a@b.co',
      full_name: 'Alice',
      role: 'admin',
      active: true,
    };
    supabaseMock.createClient.mockResolvedValueOnce(
      buildClient({ user: { id: 'auth-1' }, profile }),
    );
    const { requireUser } = await import('@/lib/auth/require-role');
    await expect(requireUser()).resolves.toEqual(profile);
  });

  it('requireRole redirects when role not allowed', async () => {
    const profile: Profile = {
      id: 'u1',
      auth_id: 'auth-1',
      company_id: 'c1',
      email: 'a@b.co',
      full_name: 'Alice',
      role: 'sales',
      active: true,
    };
    supabaseMock.createClient.mockResolvedValueOnce(
      buildClient({ user: { id: 'auth-1' }, profile }),
    );
    const { requireRole } = await import('@/lib/auth/require-role');
    await expect(requireRole(['admin', 'super_admin'])).rejects.toMatchObject({
      to: '/dashboard?error=forbidden',
    });
  });

  it('requireRole resolves when role allowed', async () => {
    const profile: Profile = {
      id: 'u2',
      auth_id: 'auth-2',
      company_id: 'c1',
      email: 'b@b.co',
      full_name: 'Bob',
      role: 'admin',
      active: true,
    };
    supabaseMock.createClient.mockResolvedValueOnce(
      buildClient({ user: { id: 'auth-2' }, profile }),
    );
    const { requireRole } = await import('@/lib/auth/require-role');
    await expect(requireRole(['admin', 'super_admin'])).resolves.toEqual(profile);
  });
});
