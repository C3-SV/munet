import type { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { searchParticipants } from '../services/participant-search.service';
import { loadWallsByEvent, mapWallForMembership } from '../services/walls.service';
import { isAdminRole } from '../utils/rbac.utils';

// Resuelve la membership del usuario para el evento solicitado.
const resolveMembershipForEvent = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;
// Usamos memberships del token para evitar roundtrip extra solo para validacion de pertenencia.

// Lista muros del evento y agrega flags de acceso/publicación según RBAC.
export const listEventWalls = async (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const membership = resolveMembershipForEvent(req, eventId);

    if (!membership) {
      // El usuario autenticado existe, pero no tiene membership en este evento.
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, name, slug')
      .eq('id', eventId)
      .is('deleted_at', null)
      .maybeSingle();
    // Si el evento fue soft-deleted, se comporta como inexistente para clientes.

    if (!event) {
      // Evita exponer muros de eventos inexistentes o eliminados lógicamente.
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const walls = await loadWallsByEvent(eventId);
    // mapWallForMembership aplica canAccess/canPublish por rol+comité.
    // Solo se devuelven los muros accesibles: un delegado no ve los comités ajenos; un admin ve todos.
    const wallViews = walls
      .map((wall) => mapWallForMembership(wall, membership))
      .filter((wall) => wall.canAccess);

    return res.json({
      event,
      membership: {
        id: membership.id,
        role: membership.role,
        committeeId: membership.committeeId,
      },
      walls: wallViews,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron cargar los muros' });
  }
};

// Lista comités del evento con marcador canAccess para UI.
export const listEventCommittees = async (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.eventId);
    const membership = resolveMembershipForEvent(req, eventId);

    if (!membership) {
      // Guard RBAC por pertenencia al evento antes de listar metadatos.
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { data: committees, error } = await supabaseAdmin
      .from('committees')
      .select('id, event_id, name, code, description, status, sort_order')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    // Orden dual: primero prioridad funcional, luego nombre para estabilidad visual.

    if (error) {
      throw new Error(error.message);
    }

    return res.json({
      committees: (committees ?? []).map((committee) => ({
        ...committee,
        // UI usa canAccess para atenuar/bloquear navegación, backend sigue siendo fuente de verdad.
        canAccess:
          isAdminRole(membership.role) || committee.id === membership.committeeId,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron cargar los comites' });
  }
};

// Directorio de delegados para consulta pública/participantes del evento (S2-11).
// Solo accesible a miembros activos del evento.
// REGLA ESTRICTA DE SEGURIDAD: Nunca devuelve participant_code ni email.
export const listEventDirectory = async (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.eventId || req.header('x-event-id') || '').trim();
    if (!eventId) {
      return res.status(400).json({ error: 'eventId o encabezado x-event-id es requerido' });
    }

    const membership = resolveMembershipForEvent(req, eventId);
    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const pageRaw = Number(req.query.page ?? 1);
    const limitRaw = Number(req.query.limit ?? 20);

    if (!Number.isInteger(pageRaw) || pageRaw < 1 || !Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos' });
    }

    const page = pageRaw;
    const limit = limitRaw;
    const committeeId = typeof req.query.committee_id === 'string' && req.query.committee_id.trim()
      ? req.query.committee_id.trim()
      : null;
    const search = typeof req.query.search === 'string'
      ? req.query.search.trim().slice(0, 100)
      : (typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '');

    // Comités del evento para armar el objeto anidado committee { id, name, code }
    const { data: eventCommittees, error: committeesError } = await supabaseAdmin
      .from('committees')
      .select('id, name, code')
      .eq('event_id', eventId)
      .is('deleted_at', null);

    if (committeesError) {
      return res.status(500).json({ error: 'No se pudieron cargar los comites' });
    }

    const committeeMap = new Map((eventCommittees ?? []).map((c) => [c.id, { id: c.id, name: c.name, code: c.code }]));

    let participants: any[] = [];
    let pagination = { page, limit, total: 0, total_pages: 0 };

    if (search) {
      // Reutiliza la búsqueda sin acentos (participant-search.service)
      const searchResult = await searchParticipants({
        eventId,
        q: search,
        filters: {
          committeeId,
          role: null,
          status: 'ACTIVE',
        },
        page,
        limit,
      });

      if (searchResult.error) {
        return res.status(400).json({ error: searchResult.error });
      }

      participants = searchResult.body?.participants ?? [];
      pagination = searchResult.body?.pagination ?? pagination;
    } else {
      let query = supabaseAdmin
        .from('event_memberships')
        .select(
          'id, event_id, role, committee_id, delegation_name, delegation_code, institution_name, account_status, created_at',
          { count: 'exact' }
        )
        .eq('event_id', eventId)
        .eq('account_status', 'ACTIVE')
        .is('deleted_at', null);

      if (committeeId) {
        query = query.eq('committee_id', committeeId);
      }

      const { data: memberships, error: membershipsError, count } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      if (membershipsError) {
        return res.status(400).json({ error: membershipsError.message });
      }

      const total = count ?? (memberships ?? []).length;
      pagination = {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 0,
      };

      const membershipIds = (memberships ?? []).map((m) => m.id);
      const { data: profiles, error: profilesError } = membershipIds.length
        ? await supabaseAdmin
          .from('profiles')
          .select('event_membership_id, first_name, last_name, display_name, alias, profile_image_path')
          .in('event_membership_id', membershipIds)
        : { data: [] as any[], error: null };

      if (profilesError) {
        return res.status(400).json({ error: profilesError.message });
      }

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.event_membership_id, p]));

      participants = (memberships ?? []).map((m) => ({
        ...m,
        profile: profileMap.get(m.id) ?? null,
      }));
    }

    // Si se buscó con search, los profiles no traen profile_image_path; cargamos los avatars necesarios
    const missingAvatarMembershipIds = participants
      .filter((p) => p.profile && p.profile.profile_image_path === undefined)
      .map((p) => p.id);

    let avatarMap = new Map<string, string | null>();
    if (missingAvatarMembershipIds.length > 0) {
      const { data: avatars } = await supabaseAdmin
        .from('profiles')
        .select('event_membership_id, profile_image_path')
        .in('event_membership_id', missingAvatarMembershipIds);
      avatarMap = new Map((avatars ?? []).map((a: any) => [a.event_membership_id, a.profile_image_path]));
    }

    // Mapeo seguro según contrato: sin participant_code ni email
    const delegates = participants.map((row) => {
      const p = row.profile;
      const committee = row.committee_id ? committeeMap.get(row.committee_id) ?? null : null;
      const avatarUrl = p?.profile_image_path ?? avatarMap.get(row.id) ?? null;

      return {
        membershipId: row.id,
        firstName: p?.first_name ?? '',
        lastName: p?.last_name ?? '',
        alias: p?.alias ?? null,
        delegationName: row.delegation_name ?? null,
        delegationCode: row.delegation_code ?? null,
        role: row.role,
        institutionName: row.institution_name ?? null,
        committee,
        avatarUrl,
      };
    });

    return res.json({
      delegates,
      pagination,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo cargar el directorio' });
  }
};
