export const ALIAS_MAX_LENGTH = 60;

// Campos que el participante no puede modificar desde PATCH /profiles/me.
export const PROTECTED_PROFILE_FIELDS = [
  'role',
  'participant_code',
  'delegation_code',
  'committee_id',
] as const;

// Valida y normaliza un alias: texto de 1 a 60 caracteres sin espacios en los extremos.
// null o texto vacío borran el alias (nunca se reemplaza por el nombre completo).
export const parseAlias = (
  raw: unknown
): { value: string | null } | { error: string } => {
  if (raw === null || raw === undefined) {
    return { value: null };
  }

  if (typeof raw !== 'string') {
    return { error: 'alias debe ser texto' };
  }

  const trimmed = raw.trim();

  if (trimmed === '') {
    return { value: null };
  }

  if (trimmed.length > ALIAS_MAX_LENGTH) {
    return { error: `alias admite hasta ${ALIAS_MAX_LENGTH} caracteres` };
  }

  return { value: trimmed };
};

// Devuelve los campos protegidos presentes en el cuerpo de la petición.
export const findProtectedFields = (body: unknown) => {
  if (!body || typeof body !== 'object') {
    return [];
  }

  return PROTECTED_PROFILE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
};
