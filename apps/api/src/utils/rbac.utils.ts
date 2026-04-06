export const normalizeRole = (role: string | null | undefined) =>
  (role ?? '').trim().toUpperCase();

export const isAdminRole = (role: string | null | undefined) => {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole.includes('ADMIN') ||
    normalizedRole.includes('COORDINADOR') ||
    normalizedRole.includes('ORGANIZADOR')
  );
};

export const isModeratorRole = (role: string | null | undefined) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole.includes('MODERADOR') || normalizedRole.includes('MODERATOR');
};

export const canAccessCommitteeWall = (params: {
  role: string;
  membershipCommitteeId: string | null;
  wallCommitteeId: string | null;
}) => {
  if (!params.wallCommitteeId) {
    return true;
  }

  if (isAdminRole(params.role)) {
    return true;
  }

  return params.membershipCommitteeId === params.wallCommitteeId;
};

export const canPublishInAnnouncements = (role: string) =>
  isAdminRole(role) || isModeratorRole(role);
