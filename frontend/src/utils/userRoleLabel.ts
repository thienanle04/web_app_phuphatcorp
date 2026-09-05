/**
 * Label hiển thị cho role user.
 * Ưu tiên tên từ API (roles.name); không phụ thuộc i18n keys cố định.
 */
export function getUserRoleLabel(
  user: { role: string; role_name?: string | null },
  t: (key: string) => string,
): string {
  if (user.role_name?.trim()) return user.role_name.trim();

  const key = `users.roles.${user.role}`;
  const translated = t(key);
  if (translated !== key) return translated;

  return user.role;
}
