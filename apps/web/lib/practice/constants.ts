// Identificadores fijos del modo práctica local. No son datos de Supabase.
export const PRACTICE_EVENT_ID = "practice-local";
export const PRACTICE_MEMBERSHIP_ID = "practice-membership";
export const PRACTICE_STATE_VERSION = 1;
export const PRACTICE_DB_PREFIX = "munet-practice-";

// Comparación estricta: no recorta espacios ni tolera variantes del identificador.
export const isPracticeEvent = (eventId: string | null | undefined): boolean =>
    eventId === PRACTICE_EVENT_ID;

// Nombre de la base de datos local (IndexedDB) asociada a un usuario.
export const practiceDbName = (userId: string): string => `${PRACTICE_DB_PREFIX}${userId}`;
