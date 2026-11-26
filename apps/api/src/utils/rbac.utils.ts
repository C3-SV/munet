// Valores de membership_role_enum en la base (supabase/schema.sql).
export const MEMBERSHIP_ROLES = ['PARTICIPANT', 'MODERATOR', 'ADMIN_MUN', 'ADMIN_TECH'] as const;

export const isMembershipRole = (role: unknown): boolean =>
  typeof role === 'string' && (MEMBERSHIP_ROLES as readonly string[]).includes(role);

// Normaliza nombres de rol para evaluarlos de forma consistente.
export const normalizeRole = (role: string | null | undefined) =>
  (role ?? '').trim().toUpperCase();

// Determina si el rol tiene privilegios administrativos: solo los dos administradores del enum.
export const isAdminRole = (role: string | null | undefined) => {
  const normalizedRole = normalizeRole(role);

  return normalizedRole === 'ADMIN_MUN' || normalizedRole === 'ADMIN_TECH';
};

// Los roles nuevos se comparan por valor exacto para no ampliar privilegios.
export const isModeratorRole = (role: string | null | undefined) =>
  normalizeRole(role) === 'MODERATOR';

export const isSuperAdminRole = (role: string | null | undefined) =>
  normalizeRole(role) === 'ADMIN_TECH';

export const canModerateRole = (role: string | null | undefined) =>
  isAdminRole(role) || isModeratorRole(role);

// Evalua acceso a muros de comite segun rol y comite asignado.
export const canAccessCommitteeWall = (params: {
  role: string;
  membershipCommitteeId: string | null;
  wallCommitteeId: string | null;
}) => {
  if (!params.wallCommitteeId) {
    return true;
  }

  if (canModerateRole(params.role)) {
    return true;
  }

  return params.membershipCommitteeId === params.wallCommitteeId;
};

// Reglas de publicacion y comentarios en el muro de avisos: administradores y moderadores.
// Los participantes regulares solo leen. Comentar en avisos usa esta misma regla.
export const canPublishInAnnouncements = (role: string) =>
  canModerateRole(role);
