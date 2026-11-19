import { supabaseAdmin } from '../lib/supabase';

// Directorio paginado de participantes activos de un evento (W02).
// Contrato: GET /events/:eventId/participants?q=&committee_id=&page=&limit=
//
// Decisiones registradas:
// - Base: perfiles unidos (!inner) a la membership del evento con
//   account_status ACTIVE y deleted_at nulo. Una membership sin perfil no se
//   lista porque no tiene nombre que mostrar.
// - Roles: se incluyen todas las memberships activas (sprint 1: "cualquier
//   miembro activo"). No se filtra por rol.
// - Comite: se devuelve solo si no esta eliminado logicamente. Un comite
//   archivado sigue visible y es filtrable (politica pendiente de confirmar).
// - Normalizacion: el filtro de Supabase no compara sin tildes ni mayusculas de
//   forma portable, asi que el texto se filtra en memoria. Coste aceptado: se
//   leen lotes de DIRECTORY_BATCH_SIZE filas en orden estable (apellido, nombre,
//   membershipId) hasta completar la pagina y una coincidencia mas para hasMore.
//   En el peor caso (pagina final o sin coincidencias) se recorre todo el
//   conjunto autorizado del evento. Medir este coste en Q03.
// - La paginacion se aplica despues del filtrado; la consulta se restringe al
//   evento en cada lote, nunca se hace una lectura transversal.

export const DIRECTORY_BATCH_SIZE = 500;
export const DIRECTORY_DEFAULT_PAGE = 1;
export const DIRECTORY_DEFAULT_LIMIT = 20;
export const DIRECTORY_MAX_LIMIT = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Columnas que salen del servicio. No incluir participant_code, email ni datos de auth.
const DIRECTORY_SELECT =
  'event_membership_id, first_name, last_name, alias, event_memberships!inner(delegation_code, committees(id, name, deleted_at))';

type DirectoryCommitteeRow = { id: string; name: string; deleted_at: string | null };
type DirectoryMembershipRow = {
  delegation_code: string | null;
  committees: DirectoryCommitteeRow | DirectoryCommitteeRow[] | null;
};
type DirectoryRow = {
  event_membership_id: string;
  first_name: string | null;
  last_name: string | null;
  alias: string | null;
  event_memberships: DirectoryMembershipRow | DirectoryMembershipRow[] | null;
};

export type DirectoryQuery = {
  q: string;
  committeeId: string | null;
  page: number;
  limit: number;
};

export type DirectoryParticipant = {
  membershipId: string;
  firstName: string;
  lastName: string;
  alias: string | null;
  committee: { id: string; name: string } | null;
  delegationCode: string | null;
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// Minusculas y sin tildes: "Muñoz" y "munoz" coinciden, igual que en la busqueda admin.
const foldText = (value: string | null | undefined) =>
  (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Toma el primer elemento cuando PostgREST devuelve un embed como array.
const firstItem = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const parseInteger = (raw: unknown, fallback: number, max: number, error: string): Parsed<number> => {
  if (raw === undefined) return { ok: true, value: fallback };
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return { ok: false, error };
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) return { ok: false, error };
  return { ok: true, value };
};

// Valida los parametros de consulta. Cualquier valor fuera de contrato devuelve error 400.
export const parseParticipantDirectoryQuery = (input: Record<string, unknown>): Parsed<DirectoryQuery> => {
  const rawQ = input.q;
  if (rawQ !== undefined && typeof rawQ !== 'string') {
    return { ok: false, error: 'q debe ser texto' };
  }

  const rawCommittee = input.committee_id;
  if (rawCommittee !== undefined && (typeof rawCommittee !== 'string' || !UUID_PATTERN.test(rawCommittee))) {
    return { ok: false, error: 'committee_id debe ser un UUID' };
  }

  const page = parseInteger(input.page, DIRECTORY_DEFAULT_PAGE, Number.MAX_SAFE_INTEGER,
    'page debe ser un entero mayor o igual a 1');
  if (!page.ok) return page;

  const limit = parseInteger(input.limit, DIRECTORY_DEFAULT_LIMIT, DIRECTORY_MAX_LIMIT,
    `limit debe ser un entero entre 1 y ${DIRECTORY_MAX_LIMIT}`);
  if (!limit.ok) return limit;

  return {
    ok: true,
    value: {
      q: rawQ ?? '',
      committeeId: rawCommittee ?? null,
      page: page.value,
      limit: limit.value,
    },
  };
};

const toParticipant = (row: DirectoryRow): DirectoryParticipant => {
  const membership = firstItem(row.event_memberships);
  const committee = firstItem(membership?.committees);

  return {
    membershipId: row.event_membership_id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    alias: row.alias ?? null,
    committee: committee && !committee.deleted_at ? { id: committee.id, name: committee.name } : null,
    delegationCode: membership?.delegation_code ?? null,
  };
};

// El codigo de delegacion se compara sin el prefijo "#", como en la busqueda admin.
const matchesText = (participant: DirectoryParticipant, term: string) => {
  if (!term) return true;

  return [
    participant.firstName,
    participant.lastName,
    `${participant.firstName} ${participant.lastName}`,
    participant.alias ?? '',
    (participant.delegationCode ?? '').replace(/^#/, ''),
  ].some((value) => foldText(value).includes(term));
};

// Lote ordenado de perfiles autorizados del evento. Los filtros de evento,
// membresia activa y comite se aplican en la base en cada lote.
const fetchBatch = (eventId: string, committeeId: string | null, from: number) => {
  let query = supabaseAdmin
    .from('profiles')
    .select(DIRECTORY_SELECT)
    .eq('event_memberships.event_id', eventId)
    .eq('event_memberships.account_status', 'ACTIVE')
    .is('event_memberships.deleted_at', null);

  if (committeeId) {
    query = query.eq('event_memberships.committee_id', committeeId);
  }

  return query
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .order('event_membership_id', { ascending: true })
    .range(from, from + DIRECTORY_BATCH_SIZE - 1) as any;
};

export const listParticipantDirectory = async (params: { eventId: string; query: DirectoryQuery }) => {
  const { eventId, query } = params;

  if (query.committeeId) {
    // El comite debe ser de este evento y no estar eliminado. Si no, 400 sin revelar otros eventos.
    const { data: committee, error: committeeError } = await supabaseAdmin
      .from('committees')
      .select('id')
      .eq('id', query.committeeId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .maybeSingle();

    if (committeeError) {
      return { status: 500, body: { error: 'No se pudo validar el comite' } };
    }
    if (!committee) {
      return { status: 400, body: { error: 'committee_id no pertenece a este evento' } };
    }
  }

  const term = foldText(query.q).replace(/^#/, '').trim();
  const start = (query.page - 1) * query.limit;
  const end = start + query.limit;
  const participants: DirectoryParticipant[] = [];
  let matchIndex = 0;
  let hasMore = false;

  for (let from = 0; !hasMore; from += DIRECTORY_BATCH_SIZE) {
    const { data, error } = await fetchBatch(eventId, query.committeeId, from);
    if (error) {
      return { status: 500, body: { error: 'No se pudieron consultar los participantes' } };
    }

    const rows = (data ?? []) as DirectoryRow[];
    for (const row of rows) {
      const participant = toParticipant(row);
      if (!matchesText(participant, term)) continue;

      // Llegar a la posicion `end` demuestra que existe una pagina siguiente; no hace falta seguir leyendo.
      if (matchIndex === end) {
        hasMore = true;
        break;
      }
      if (matchIndex >= start) participants.push(participant);
      matchIndex += 1;
    }

    if (rows.length < DIRECTORY_BATCH_SIZE) break;
  }

  return {
    status: 200,
    body: {
      participants,
      page: query.page,
      limit: query.limit,
      hasMore,
    },
  };
};
