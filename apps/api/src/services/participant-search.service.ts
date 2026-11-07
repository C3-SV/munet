import { supabaseAdmin } from '../lib/supabase';

// Busqueda de participantes del panel admin (S2-04).
// Con texto libre se traen las memberships del evento (con los filtros ya
// aplicados en la base) y sus perfiles, y se filtra en memoria. Un evento
// tiene cientos de personas, asi que es correcto, no tiene tope artificial y
// permite comparar sin mayusculas ni tildes.

const PAGE_SIZE = 1000;

export const MEMBERSHIP_LIST_COLUMNS =
  'id, event_id, user_id, participant_code, delegation_code, role, committee_id, delegation_name, institution_name, account_status, created_at';

const fold = (value: string | null | undefined) =>
  (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

type Filters = { committeeId: string | null; role: string | null; status: string | null };
type MembershipRow = { id: string; created_at: string; participant_code: string | null; delegation_code: string | null } & Record<string, unknown>;
type ProfileRow = { event_membership_id: string; first_name: string | null; last_name: string | null; display_name: string | null; alias: string | null };

const loadAll = async <T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
};

export const searchParticipants = async (params: {
  eventId: string;
  q: string;
  filters: Filters;
  page: number;
  limit: number;
}) => {
  const { eventId, q, filters, page, limit } = params;

  const memberships = await loadAll<MembershipRow>((from, to) => {
    let query = supabaseAdmin
      .from('event_memberships')
      .select(MEMBERSHIP_LIST_COLUMNS)
      .eq('event_id', eventId)
      .is('deleted_at', null);
    if (filters.committeeId) query = query.eq('committee_id', filters.committeeId);
    if (filters.role) query = query.eq('role', filters.role);
    if (filters.status) query = query.eq('account_status', filters.status);
    return query.order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to) as any;
  });
  if (memberships.error) return { error: memberships.error.message };

  const profiles = await loadAll<ProfileRow>((from, to) =>
    supabaseAdmin
      .from('profiles')
      .select('event_membership_id, first_name, last_name, display_name, alias, event_memberships!inner(event_id)')
      .eq('event_memberships.event_id', eventId)
      .order('event_membership_id', { ascending: true })
      .range(from, to) as any
  );
  if (profiles.error) return { error: profiles.error.message };

  const profileByMembership = new Map(profiles.rows.map((p) => [p.event_membership_id, p]));
  const term = fold(q).replace(/^#/, '');

  const matches = memberships.rows.filter((m) => {
    const p = profileByMembership.get(m.id);
    const haystack = [
      m.participant_code,
      (m.delegation_code ?? '').replace(/^#/, ''),
      p?.first_name,
      p?.last_name,
      p ? `${p.first_name ?? ''} ${p.last_name ?? ''}` : '',
      p?.display_name,
      p?.alias,
    ];
    return haystack.some((value) => fold(value).includes(term));
  });

  const total = matches.length;
  const participants = matches.slice((page - 1) * limit, page * limit).map((m) => {
    const p = profileByMembership.get(m.id);
    return {
      ...m,
      profile: p
        ? { event_membership_id: p.event_membership_id, first_name: p.first_name, last_name: p.last_name, display_name: p.display_name, alias: p.alias }
        : null,
    };
  });

  return {
    body: {
      participants,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    },
  };
};