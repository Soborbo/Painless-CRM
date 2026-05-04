import { getTranslations } from 'next-intl/server';

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
};

export async function UsersList({
  rows,
  currentUserId,
}: {
  rows: UserRow[];
  currentUserId: string;
}) {
  const t = await getTranslations('users');

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">{t('noTeamMembers')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">{t('fullName')}</th>
            <th className="px-3 py-2 font-medium">{t('inviteEmail')}</th>
            <th className="px-3 py-2 font-medium">{t('inviteRole')}</th>
            <th className="px-3 py-2 font-medium">{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-3 py-2">
                {row.full_name}
                {row.id === currentUserId ? (
                  <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
                    ({t('you')})
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">{row.email}</td>
              <td className="px-3 py-2">{t(`roles.${row.role}` as never)}</td>
              <td className="px-3 py-2">{row.active ? t('statusActive') : t('statusInactive')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
