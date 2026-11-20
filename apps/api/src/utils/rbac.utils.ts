// Valores de membership_role_enum en la base (supabase/schema.sql).
export const MEMBERSHIP_ROLES = ['PARTICIPANT', 'MODERATOR', 'ADMIN_MUN', 'ADMIN_TECH'] as const;

export const isMembershipRole = (role: unknown): boolean =>
  typeof role === 'string' && (MEMBERSHIP_ROLES as readonly string[]).includes(role);

// Normaliza nombres de rol para evaluarlos de forma consistente.
export const normalizeRole = (role: string | null | undefined) =>
  (role ?? '').trim().toUpperCase();

// Determina si el rol tiene privilegios administrativos.
export const isAdminRole = (role: string | null | undefined) => {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole.includes('ADMIN') ||
    normalizedRole.includes('COORDINADOR') ||
    normalizedRole.includes('ORGANIZADOR')
  );
};

// Detector auxiliar de roles moderadores para posibles reglas futuras.
export const isModeratorRole = (role: string | null | undefined) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole.includes('MODERADOR') || normalizedRole.includes('MODERATOR');
};

// Evalua acceso a muros de comite segun rol y comite asignado.
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

// Reglas de publicacion para muro de avisos (solo staff/admin).
export const canPublishInAnnouncements = (role: string) =>
  isAdminRole(role);
