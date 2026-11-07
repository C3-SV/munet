import { randomBytes } from 'node:crypto';
import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../utils/audit.logger';
import bcrypt from 'bcrypt';
import { validateCatalogBody } from '../utils/admin.validation';
import { generateInitialPassword } from '../utils/password.utils';
import { isAdminRole } from '../utils/rbac.utils';
import { assignDelegationCode, createParticipantAccount } from '../services/participant-account.service';
import { searchParticipants } from '../services/participant-search.service';

// Helper para detectar si una propiedad viene explicitamente en el payload.
const hasOwn = (payload: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(payload, key);

type CreateAccountBody = {
  event_id: string;
  participant_code: string;
  role: string;
  committee_id?: string;
  delegation_name?: string;
  institution_name?: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  bio?: string;
  alias?: string | null;
};

// Alta individual: user + membership + profile + codigo # (S1-11, S2-03).
// La logica vive en participant-account.service para que la importacion CSV
// siga las mismas reglas. Si un paso falla se deshace lo creado.
// La contrasena inicial se devuelve UNA sola vez y no se guarda en claro.
export const createAccount = async (
  req: Request<{}, {}, CreateAccountBody>,
  res: Response
) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const actorUserId = req.auth?.userId ?? null;
    const body = req.body ?? ({} as CreateAccountBody);
    const { event_id, participant_code, role, first_name, last_name } = body;

    if (!event_id || !participant_code || !role || !first_name || !last_name) {
      return res.status(400).json({
        error: 'event_id, participant_code, role, first_name y last_name son requeridos'
      });
    }

    if (body.alias !== undefined && body.alias !== null && (typeof body.alias !== 'string' || body.alias.trim().length > 60)) {
      return res.status(400).json({ error: 'alias debe ser texto de hasta 60 caracteres' });
    }

    const result = await createParticipantAccount(
      {
        event_id,
        participant_code,
        role,
        committee_id: body.committee_id ?? null,
        delegation_name: body.delegation_name ?? null,
        institution_name: body.institution_name ?? null,
        first_name,
        last_name,
        display_name: body.display_name ?? null,
        bio: body.bio ?? null,
        alias: typeof body.alias === 'string' ? body.alias.trim() || null : null,
      },
      actorUserId
    );

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    await logAudit({
      eventId: event_id,
      membership: req.auth?.currentMembership,
      actorUserId: actorUserId ?? undefined,
      actionType: 'CREATE_ACCOUNT',
      entityType: 'ACCOUNT',
      entityId: result.membership.id,
      outcome: 'SUCCESS',
      reason: `Cuenta creada con codigo ${participant_code} y rol ${role}`,
    });

    return res.json({
      message: 'Cuenta creada correctamente',
      user: result.user,
      membership: result.membership,
      profile: result.profile,
      initial_password: result.initialPassword,
      delegation_code: result.delegationCode,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type CreateEventBody = {
  name: string;
  slug: string;
  description?: string;
  start_date?: string;
  end_date?: string;
};

// Alta de evento con validación de slug único.
export const createEvent = async (
  req: Request<{}, {}, CreateEventBody>,
  res: Response
) => {
  try {
    const validationError = validateCatalogBody(req.body, 'event', false);
    if (validationError) return res.status(400).json({ error: validationError });
    const actorUserId = req.auth?.userId ?? null;
    const { name, slug, description, start_date, end_date } = req.body;

    // 1. validaciones básicas
    if (!name || !slug) {
      return res.status(400).json({ error: 'name y slug son requeridos' });
    }

    // 2. validar slug único
    const { data: existing, error: existingLookupError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingLookupError) {
      return res.status(500).json({ error: 'No se pudo validar el slug' });
    }
    if (existing) {
      return res.status(400).json({ error: 'El slug ya existe' });
    }

    // 3. crear evento
    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert({
        name,
        slug,
        description,
        start_date,
        end_date,
        status: 'ACTIVE',
        is_read_only: false,
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // 4. dar acceso administrativo al creador sobre el evento que acaba de
    // crear: con la autorizacion acotada por evento (ADR-004/P-01), sin esto
    // quedaria sin poder administrar su propio evento. Si falla, se revierte
    // el evento para no dejarlo huerfano sin ningun admin.
    const { error: membershipError } = await supabaseAdmin
      .from('event_memberships')
      .insert({
        event_id: event.id,
        user_id: actorUserId,
        participant_code: `ADM-${randomBytes(4).toString('hex')}`,
        role: 'ADMIN',
        account_status: 'ACTIVE',
        status_changed_at: new Date().toISOString(),
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      });

    if (membershipError) {
      const { error: rollbackError } = await supabaseAdmin
        .from('events')
        .update({ deleted_at: new Date().toISOString(), updated_by_user_id: actorUserId })
        .eq('id', event.id);

      if (rollbackError) {
        console.error('Error revirtiendo evento sin membership admin:', rollbackError);
        return res.status(500).json({
          error: 'No se pudo otorgar acceso administrativo ni revertir el evento. Se requiere revision del administrador.'
        });
      }

      return res.status(400).json({
        error: `No se pudo otorgar acceso administrativo sobre el evento: ${membershipError.message}`
      });
    }

    await logAudit({
      eventId: event.id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'CREATE_EVENT',
      entityType: 'EVENT',
      entityId: event.id,
      outcome: 'SUCCESS',
      reason: `Evento creado: ${name} (${slug})`,
    });

    return res.json({
      message: 'Evento creado correctamente',
      event
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Lista los eventos no eliminados donde el usuario tiene membership admin
// activa (ADR-004/P-01: ya no se listan eventos ajenos).
export const listEvents = async (req: Request, res: Response) => {
  try {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(page * limit)) {
      return res.status(400).json({ error: 'page debe ser positivo y limit debe estar entre 1 y 100' });
    }

    const adminEventIds = (req.auth?.memberships ?? [])
      .filter((m) => isAdminRole(m.role) && m.accountStatus === 'ACTIVE')
      .map((m) => m.eventId);

    if (adminEventIds.length === 0) {
      return res.json({ events: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const { data: events, error, count } = await supabaseAdmin
      .from('events')
      .select(
        'id, name, slug, description, start_date, end_date, status, is_read_only, created_at', { count: 'exact' }
      )
      .in('id', adminEventIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ events: events ?? [], pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve el detalle de un evento por id para vista de administrador.
export const getEvent = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select(
        'id, name, slug, description, start_date, end_date, status, is_read_only, created_at'
      )
      .eq('id', eventId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    return res.json({ event });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type UpdateEventBody = {
  name?: string;
  slug?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
};

const EVENT_STATUSES = ['ACTIVE', 'CLOSED', 'ARCHIVED'] as const;

// Actualiza campos parciales de un evento existente. Cualquier transicion
// de status es valida (sin maquina de estados).
export const updateEvent = async (
  req: Request<{ eventId: string }, {}, UpdateEventBody>,
  res: Response
) => {
  try {
    const validationError = validateCatalogBody(req.body, 'event', true);
    if (validationError) return res.status(400).json({ error: validationError });
    const actorUserId = req.auth?.userId ?? null;
    const { eventId } = req.params;
    const payload = (req.body ?? {}) as Record<string, unknown>;

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('events')
      .select('id, start_date, end_date')
      .eq('id', eventId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'No se pudo consultar el registro' });
    if (!existing) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const dateError = validateCatalogBody({ start_date: hasOwn(payload, 'start_date') ? payload.start_date : existing.start_date, end_date: hasOwn(payload, 'end_date') ? payload.end_date : existing.end_date }, 'event', true);
    if (dateError) return res.status(400).json({ error: dateError });

    if (hasOwn(payload, 'slug')) {
      const { data: slugConflict, error: slugConflictLookupError } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('slug', payload.slug as string)
        .neq('id', eventId)
        .is('deleted_at', null)
        .maybeSingle();

      if (slugConflictLookupError) return res.status(500).json({ error: 'No se pudo validar el registro' });
    if (slugConflict) {
        return res.status(400).json({ error: 'El slug ya existe' });
      }
    }

    if (
      hasOwn(payload, 'status') &&
      !EVENT_STATUSES.includes(payload.status as (typeof EVENT_STATUSES)[number])
    ) {
      return res.status(400).json({
        error: `status debe ser uno de: ${EVENT_STATUSES.join(', ')}`
      });
    }

    const update: Record<string, unknown> = {
      updated_by_user_id: actorUserId,
    };

    (['name', 'slug', 'description', 'start_date', 'end_date', 'status'] as const).forEach(
      (field) => {
        if (hasOwn(payload, field)) {
          update[field] = payload[field];
        }
      }
    );

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .update(update)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const changedFields = Object.keys(update).filter((key) => key !== 'updated_by_user_id');

    await logAudit({
      eventId,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'UPDATE_EVENT',
      entityType: 'EVENT',
      entityId: eventId,
      outcome: 'SUCCESS',
      reason: `Evento actualizado: ${changedFields.join(', ') || 'sin cambios'}`,
    });

    return res.json({
      message: 'Evento actualizado correctamente',
      event
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type CreateMembershipBody = {
  event_id: string;
  user_id: string;
  participant_code: string;
  role: string;
  committee_id?: string;
  delegation_name?: string;
  institution_name?: string;
};

// Crea membership para un usuario existente dentro de un evento.
export const createMembership = async (
  req: Request<{}, {}, CreateMembershipBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const {
      event_id,
      user_id,
      participant_code,
      role,
      committee_id,
      delegation_name,
      institution_name
    } = req.body;

    // 1. validaciones básicas
    if (!event_id || !user_id || !participant_code || !role) {
      return res.status(400).json({
        error: 'event_id, user_id, participant_code y role son requeridos'
      });
    }

    // 2. validar que el evento exista
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', event_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // 3. validar que el user exista
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user_id)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 4. validar código único dentro del evento
    const { data: existingCode } = await supabaseAdmin
      .from('event_memberships')
      .select('id')
      .eq('event_id', event_id)
      .eq('participant_code', participant_code)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingCode) {
      return res.status(400).json({
        error: 'participant_code ya existe en este evento'
      });
    }

    // 5. crear membership
    const { data: membership, error } = await supabaseAdmin
      .from('event_memberships')
      .insert({
        event_id,
        user_id,
        participant_code,
        role,
        committee_id,
        delegation_name,
        institution_name,
        account_status: 'PENDING_ACTIVATION',
        status_changed_at: new Date().toISOString(),
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAudit({
      eventId: event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'CREATE_MEMBERSHIP',
      entityType: 'MEMBERSHIP',
      entityId: membership.id,
      outcome: 'SUCCESS',
      reason: `Membership creada con codigo ${participant_code} y rol ${role}`,
    });

    const { code: delegationCode, error: codeError } = await assignDelegationCode(membership.id);
    if (codeError) console.error('No se pudo asignar el codigo de delegacion', membership.id, codeError);

    return res.json({
      message: 'Membership creada correctamente',
      membership: { ...membership, delegation_code: delegationCode },
      warnings: codeError ? ['La membership se creo pero no se pudo asignar el codigo #.'] : []
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type CreateCommitteeBody = {
  event_id: string;
  name: string;
  code: string;
  description?: string;
  sort_order?: number;
};

// Crea comité dentro de un evento, validando unicidad de nombre/código.
export const createCommittee = async (
  req: Request<{}, {}, CreateCommitteeBody>,
  res: Response
) => {
  try {
    const validationError = validateCatalogBody(req.body, 'committee', false);
    if (validationError) return res.status(400).json({ error: validationError });
    const actorUserId = req.auth?.userId ?? null;
    const {
      event_id,
      name,
      code,
      description,
      sort_order
    } = req.body;

    if (!event_id || !name || !code) {
      return res.status(400).json({
        error: 'event_id, name y code son requeridos'
      });
    }

    // 1. validar que el evento exista
    const { data: event, error: eventLookupError } = await supabaseAdmin
      .from('events')
      .select('id, status')
      .eq('id', event_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (eventLookupError) return res.status(500).json({ error: 'No se pudo validar el registro' });
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // no permitir crear comités en eventos cerrados/archivados
    if (event.status === 'CLOSED' || event.status === 'ARCHIVED') {
      return res.status(400).json({
        error: 'No se pueden crear comités en un evento cerrado o archivado'
      });
    }

    // 2. validar unicidad del nombre dentro del evento
    const { data: existingName, error: existingNameLookupError } = await supabaseAdmin
      .from('committees')
      .select('id')
      .eq('event_id', event_id)
      .eq('name', name)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingNameLookupError) return res.status(500).json({ error: 'No se pudo validar el registro' });
    if (existingName) {
      return res.status(400).json({
        error: 'Ya existe un comité con ese nombre en este evento'
      });
    }

    // 3. validar unicidad del code dentro del evento
    const { data: existingCode, error: existingCodeLookupError } = await supabaseAdmin
      .from('committees')
      .select('id')
      .eq('event_id', event_id)
      .eq('code', code)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingCodeLookupError) return res.status(500).json({ error: 'No se pudo validar el registro' });
    if (existingCode) {
      return res.status(400).json({
        error: 'Ya existe un comité con ese código en este evento'
      });
    }

    // 4. crear comité
    const { data: committee, error } = await supabaseAdmin
      .from('committees')
      .insert({
        event_id,
        name,
        code,
        description,
        sort_order: sort_order ?? 0,
        status: 'ACTIVE',
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // 5. crear muro asociado automaticamente; si falla, revertir el comite
    // para no dejarlo huerfano sin muro donde publicar.
    const { data: wall, error: wallError } = await supabaseAdmin
      .from('walls')
      .insert({
        event_id,
        name,
        wall_type: 'COMMITTEE',
        committee_id: committee.id,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (wallError || !wall) {
      const { error: rollbackError } = await supabaseAdmin
        .from('committees')
        .update({
          deleted_at: new Date().toISOString(),
          updated_by_user_id: actorUserId,
        })
        .eq('id', committee.id);

      if (rollbackError) {
        console.error('Error revirtiendo comit? sin muro:', rollbackError);
        return res.status(500).json({ error: 'No se pudo crear el muro ni revertir el comit?. Se requiere revisi?n del administrador.' });
      }
      return res.status(400).json({
        error: `No se pudo crear el muro del comite: ${wallError?.message ?? 'sin datos'}`
      });
    }

    await logAudit({
      eventId: event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'CREATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committee.id,
      outcome: 'SUCCESS',
      reason: `Comite creado: ${name} (${code}), muro ${wall.id} creado automaticamente`,
    });

    return res.json({
      message: 'Comité creado correctamente',
      committee,
      wall
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve eventos/memberships pendientes de activación para un participant_code.
export const getEventsByParticipantCode = async (
  req: Request,
  res: Response
) => {
  try {
    const { participant_code } = req.params;

    if (!participant_code) {
      return res.status(400).json({
        error: 'participant_code es requerido'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('event_memberships')
      .select(`
        id,
        participant_code,
        account_status,
        role,
        event_id,
        events (
          id,
          name,
          slug,
          status,
          start_date,
          end_date,
          deleted_at
        )
      `)
      .eq('participant_code', participant_code)
      .eq('account_status', 'PENDING_ACTIVATION')
      .is('deleted_at', null);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const events = (data ?? [])
      .map((item: any) => ({
        membership_id: item.id,
        participant_code: item.participant_code,
        account_status: item.account_status,
        role: item.role,
        event: Array.isArray(item.events) ? item.events[0] : item.events
      }))
      .filter((item: any) => item.event && !item.event.deleted_at);

    return res.json({ events });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Lista comites de un evento para vista de administrador (sin requerir
// membership del actor en ese evento, a diferencia del endpoint de participantes).
export const listCommittees = async (req: Request, res: Response) => {
  try {
    const eventId = typeof req.query.event_id === 'string' ? req.query.event_id : null;

    if (!eventId) {
      return res.status(400).json({ error: 'event_id es requerido' });
    }

    const { data: committees, error } = await supabaseAdmin
      .from('committees')
      .select('id, event_id, name, code, description, sort_order, status')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ committees: committees ?? [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve el detalle de un comite por id para vista de administrador.
export const getCommittee = async (req: Request, res: Response) => {
  try {
    const { committeeId } = req.params;

    const { data: committee, error } = await supabaseAdmin
      .from('committees')
      .select('id, event_id, name, code, description, sort_order, status')
      .eq('id', committeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!committee) {
      return res.status(404).json({ error: 'Comité no encontrado' });
    }

    return res.json({ committee });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type UpdateCommitteeBody = {
  name?: string;
  code?: string;
  description?: string;
  sort_order?: number;
};

// Actualiza campos parciales de un comite y sincroniza el nombre de su muro.
export const updateCommittee = async (
  req: Request<{ committeeId: string }, {}, UpdateCommitteeBody>,
  res: Response
) => {
  try {
    const validationError = validateCatalogBody(req.body, 'committee', true);
    if (validationError) return res.status(400).json({ error: validationError });
    const actorUserId = req.auth?.userId ?? null;
    const { committeeId } = req.params;
    const payload = (req.body ?? {}) as Record<string, unknown>;

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('committees')
      .select('id, event_id')
      .eq('id', committeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'No se pudo consultar el registro' });
    if (!existing) {
      return res.status(404).json({ error: 'Comité no encontrado' });
    }

    if (hasOwn(payload, 'name')) {
      const { data: nameConflict, error: nameConflictLookupError } = await supabaseAdmin
        .from('committees')
        .select('id')
        .eq('event_id', existing.event_id)
        .eq('name', payload.name as string)
        .neq('id', committeeId)
        .is('deleted_at', null)
        .maybeSingle();

      if (nameConflictLookupError) return res.status(500).json({ error: 'No se pudo validar el registro' });
    if (nameConflict) {
        return res.status(400).json({
          error: 'Ya existe un comité con ese nombre en este evento'
        });
      }
    }

    if (hasOwn(payload, 'code')) {
      const { data: codeConflict, error: codeConflictLookupError } = await supabaseAdmin
        .from('committees')
        .select('id')
        .eq('event_id', existing.event_id)
        .eq('code', payload.code as string)
        .neq('id', committeeId)
        .is('deleted_at', null)
        .maybeSingle();

      if (codeConflictLookupError) return res.status(500).json({ error: 'No se pudo validar el registro' });
    if (codeConflict) {
        return res.status(400).json({
          error: 'Ya existe un comité con ese código en este evento'
        });
      }
    }

    const update: Record<string, unknown> = {
      updated_by_user_id: actorUserId,
    };

    (['name', 'code', 'description', 'sort_order'] as const).forEach((field) => {
      if (hasOwn(payload, field)) {
        update[field] = payload[field];
      }
    });

    const { data: committee, error } = await supabaseAdmin
      .from('committees')
      .update(update)
      .eq('id', committeeId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (hasOwn(payload, 'name')) {
      const { error: wallError } = await supabaseAdmin
        .from('walls')
        .update({ name: payload.name as string })
        .eq('committee_id', committeeId)
        .is('deleted_at', null);
      if (wallError) {
        return res.status(500).json({ error: 'El comit? se actualiz?, pero no se pudo sincronizar el muro. Reintenta guardar.' });
      }
    }

    const changedFields = Object.keys(update).filter((key) => key !== 'updated_by_user_id');

    await logAudit({
      eventId: existing.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'UPDATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committeeId,
      outcome: 'SUCCESS',
      reason: `Comite actualizado: ${changedFields.join(', ') || 'sin cambios'}`,
    });

    return res.json({
      message: 'Comité actualizado correctamente',
      committee
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Elimina logicamente un comite y su muro asociado.
export const deleteCommittee = async (
  req: Request<{ committeeId: string }>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { committeeId } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('committees')
      .select('id, event_id')
      .eq('id', committeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Comité no encontrado' });
    }

    const deletedAt = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('committees')
      .update({ deleted_at: deletedAt, updated_by_user_id: actorUserId })
      .eq('id', committeeId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { error: wallError } = await supabaseAdmin
      .from('walls')
      .update({ deleted_at: deletedAt })
      .eq('committee_id', committeeId);

    if (wallError) {
      // El comite ya quedo eliminado; el muro huerfano se loguea para revision manual.
      console.error(
        `No se pudo eliminar el muro del comite ${committeeId}: ${wallError.message}`
      );
    }

    await logAudit({
      eventId: existing.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'DELETE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committeeId,
      outcome: 'SUCCESS',
      reason: 'Comite eliminado (soft delete) junto con su muro asociado',
    });

    return res.json({ message: 'Comité eliminado correctamente' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// ─── Participantes ──────────────────────────────────────────────────────

// Lista participantes de un evento (autorizacion ya resuelta por
// requireEventAdmin: event_id siempre viene de un admin de ese evento).
export const listParticipants = async (req: Request, res: Response) => {
  try {
    const eventId = typeof req.query.event_id === 'string' ? req.query.event_id : null;
    if (!eventId) {
      return res.status(400).json({ error: 'event_id es requerido' });
    }

    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(page * limit)) {
      return res.status(400).json({ error: 'page debe ser positivo y limit debe estar entre 1 y 100' });
    }

    let query = supabaseAdmin
      .from('event_memberships')
      .select(
        'id, event_id, user_id, participant_code, delegation_code, role, committee_id, delegation_name, institution_name, account_status, created_at',
        { count: 'exact' }
      )
      .eq('event_id', eventId)
      .is('deleted_at', null);

    const committeeId = typeof req.query.committee_id === 'string' ? req.query.committee_id : null;
    if (committeeId) query = query.eq('committee_id', committeeId);


    // q: busqueda por texto (codigo de login, codigo #, nombre, apellido o
    // alias, sin mayusculas ni tildes). Ver participant-search.service.
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) {
      const result = await searchParticipants({
        eventId,
        q,
        page,
        limit,
        filters: {
          committeeId,
          role: typeof req.query.role === 'string' ? req.query.role : null,
          status: typeof req.query.status === 'string' ? req.query.status : null,
        },
      });
      if (result.error) return res.status(400).json({ error: result.error });
      return res.json(result.body);
    }

    const role = typeof req.query.role === 'string' ? req.query.role : null;
    if (role) query = query.eq('role', role);

    const status = typeof req.query.status === 'string' ? req.query.status : null;
    if (status) query = query.eq('account_status', status);

    const { data: memberships, error, count } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const membershipIds = (memberships ?? []).map((membership) => membership.id);
    const { data: profiles, error: profilesError } = membershipIds.length
      ? await supabaseAdmin
          .from('profiles')
          .select('event_membership_id, first_name, last_name, display_name, alias')
          .in('event_membership_id', membershipIds)
      : { data: [] as { event_membership_id: string }[], error: null };

    if (profilesError) {
      return res.status(400).json({ error: profilesError.message });
    }

    const profileByMembership = new Map(
      (profiles ?? []).map((profile: any) => [profile.event_membership_id, profile])
    );

    const participants = (memberships ?? []).map((membership) => ({
      ...membership,
      profile: profileByMembership.get(membership.id) ?? null,
    }));

    return res.json({
      participants,
      pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve el detalle de un participante (membership + perfil).
export const getParticipant = async (req: Request<{ membershipId: string }>, res: Response) => {
  try {
    const { membershipId } = req.params;

    const { data: membership, error } = await supabaseAdmin
      .from('event_memberships')
      .select(
        'id, event_id, user_id, participant_code, delegation_code, role, committee_id, delegation_name, institution_name, account_status, created_at'
      )
      .eq('id', membershipId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    if (!membership) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, display_name, alias, bio, profile_image_path')
      .eq('event_membership_id', membershipId)
      .maybeSingle();

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    return res.json({ participant: { ...membership, profile: profile ?? null } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type UpdateParticipantBody = {
  role?: string;
  committee_id?: string | null;
  delegation_name?: string | null;
  institution_name?: string | null;
  first_name?: string;
  last_name?: string;
  display_name?: string | null;
  alias?: string | null;
  bio?: string | null;
};

// Campos editables: NO incluye event_id ni participant_code (RN-03: el
// codigo es inmutable y no reasignable).
const PARTICIPANT_MEMBERSHIP_FIELDS = ['role', 'committee_id', 'delegation_name', 'institution_name'] as const;
const PARTICIPANT_PROFILE_FIELDS = ['first_name', 'last_name', 'display_name', 'alias', 'bio'] as const;

// Actualiza datos de membership y/o perfil de un participante existente.
export const updateParticipant = async (
  req: Request<{ membershipId: string }, {}, UpdateParticipantBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { membershipId } = req.params;
    const payload = (req.body ?? {}) as Record<string, unknown>;

    const hasMembershipField = PARTICIPANT_MEMBERSHIP_FIELDS.some((field) => hasOwn(payload, field));
    const hasProfileField = PARTICIPANT_PROFILE_FIELDS.some((field) => hasOwn(payload, field));

    if (!hasMembershipField && !hasProfileField) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    if (hasOwn(payload, 'alias') && payload.alias !== null && (typeof payload.alias !== 'string' || payload.alias.trim().length > 60)) {
      return res.status(400).json({ error: 'alias debe ser texto de hasta 60 caracteres o null' });
    }
    if (typeof payload.alias === 'string') payload.alias = payload.alias.trim() || null;

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('event_memberships')
      .select('id, event_id')
      .eq('id', membershipId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'No se pudo consultar el registro' });
    if (!existing) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    if (hasOwn(payload, 'committee_id') && payload.committee_id) {
      const { data: committee, error: committeeLookupError } = await supabaseAdmin
        .from('committees')
        .select('id, event_id, status')
        .eq('id', payload.committee_id as string)
        .is('deleted_at', null)
        .maybeSingle();

      if (committeeLookupError) return res.status(500).json({ error: 'No se pudo validar el comité' });
      if (!committee) {
        return res.status(404).json({ error: 'Comité no encontrado' });
      }
      if (committee.event_id !== existing.event_id) {
        return res.status(400).json({ error: 'El comité no pertenece al evento de este participante' });
      }
      if (committee.status === 'ARCHIVED') {
        return res.status(400).json({ error: 'El comite esta archivado' });
      }
    }

    if (hasMembershipField) {
      const update: Record<string, unknown> = { updated_by_user_id: actorUserId };
      PARTICIPANT_MEMBERSHIP_FIELDS.forEach((field) => {
        if (hasOwn(payload, field)) update[field] = payload[field];
      });

      const { error: membershipError } = await supabaseAdmin
        .from('event_memberships')
        .update(update)
        .eq('id', membershipId);

      if (membershipError) {
        return res.status(400).json({ error: membershipError.message });
      }
    }

    if (hasProfileField) {
      const update: Record<string, unknown> = { updated_by_membership_id: membershipId };
      PARTICIPANT_PROFILE_FIELDS.forEach((field) => {
        if (hasOwn(payload, field)) update[field] = payload[field];
      });

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(update)
        .eq('event_membership_id', membershipId);

      if (profileError) {
        return res.status(400).json({ error: profileError.message });
      }
    }

    const changedFields = [...PARTICIPANT_MEMBERSHIP_FIELDS, ...PARTICIPANT_PROFILE_FIELDS].filter((field) =>
      hasOwn(payload, field)
    );

    await logAudit({
      eventId: existing.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'UPDATE_PARTICIPANT',
      entityType: 'MEMBERSHIP',
      entityId: membershipId,
      outcome: 'SUCCESS',
      reason: `Participante actualizado: ${changedFields.join(', ') || 'sin cambios'}`,
    });

    return res.json({ message: 'Participante actualizado correctamente' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type AccountStatusActionBody = { reason?: string };

// Suspende una cuenta (RN-18: requiere motivo). La fecha queda en
// status_changed_at y el motivo en audit_logs.
export const suspendParticipant = async (
  req: Request<{ membershipId: string }, {}, AccountStatusActionBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { membershipId } = req.params;
    const reason = req.body?.reason?.trim();

    if (!reason) {
      return res.status(400).json({ error: 'reason es requerido para suspender una cuenta' });
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('event_memberships')
      .select('id, event_id, account_status')
      .eq('id', membershipId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'No se pudo consultar el registro' });
    if (!existing) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }
    if (existing.account_status === 'SUSPENDED') {
      return res.status(400).json({ error: 'La cuenta ya está suspendida' });
    }

    const { data: membership, error } = await supabaseAdmin
      .from('event_memberships')
      .update({
        account_status: 'SUSPENDED',
        status_changed_at: new Date().toISOString(),
        updated_by_user_id: actorUserId,
      })
      .eq('id', membershipId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAudit({
      eventId: existing.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'SUSPEND_ACCOUNT',
      entityType: 'ACCOUNT',
      entityId: membershipId,
      outcome: 'SUCCESS',
      reason,
    });

    return res.json({ message: 'Cuenta suspendida correctamente', membership });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Reactiva una cuenta previamente suspendida (requiere motivo, igual que
// suspender, para mantener trazabilidad simetrica en audit_logs).
export const reactivateParticipant = async (
  req: Request<{ membershipId: string }, {}, AccountStatusActionBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { membershipId } = req.params;
    const reason = req.body?.reason?.trim();

    if (!reason) {
      return res.status(400).json({ error: 'reason es requerido para reactivar una cuenta' });
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('event_memberships')
      .select('id, event_id, account_status')
      .eq('id', membershipId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'No se pudo consultar el registro' });
    if (!existing) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }
    if (existing.account_status !== 'SUSPENDED') {
      return res.status(400).json({ error: 'Solo una cuenta suspendida puede reactivarse' });
    }

    const { data: membership, error } = await supabaseAdmin
      .from('event_memberships')
      .update({
        account_status: 'ACTIVE',
        status_changed_at: new Date().toISOString(),
        updated_by_user_id: actorUserId,
      })
      .eq('id', membershipId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAudit({
      eventId: existing.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'REACTIVATE_ACCOUNT',
      entityType: 'ACCOUNT',
      entityId: membershipId,
      outcome: 'SUCCESS',
      reason,
    });

    return res.json({ message: 'Cuenta reactivada correctamente', membership });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Restablece la contraseña de un participante. Si aun no activo su cuenta,
// regenera la contraseña inicial de un solo uso (initial_password_hash). Si
// ya esta activa, la autenticacion real vive en Supabase Auth (ver
// auth.controller#activateAccount/login), asi que se actualiza alla.
export const resetParticipantPassword = async (
  req: Request<{ membershipId: string }>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { membershipId } = req.params;

    const { data: membership, error: lookupError } = await supabaseAdmin
      .from('event_memberships')
      .select('id, event_id, user_id, account_status, participant_code')
      .eq('id', membershipId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'No se pudo consultar el registro' });
    if (!membership) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    if (membership.account_status === 'SUSPENDED') {
      return res.status(400).json({
        error: 'No se puede restablecer la contraseña de una cuenta suspendida. Reactívala primero.'
      });
    }

    const temporaryPassword = generateInitialPassword();

    if (membership.account_status === 'PENDING_ACTIVATION') {
      const initialPasswordHash = await bcrypt.hash(temporaryPassword, 10);
      const { error } = await supabaseAdmin
        .from('event_memberships')
        .update({ initial_password_hash: initialPasswordHash, updated_by_user_id: actorUserId })
        .eq('id', membershipId);

      if (error) {
        return res.status(400).json({ error: error.message });
      }
    } else {
      const { data: user, error: userLookupError } = await supabaseAdmin
        .from('users')
        .select('supabase_auth_user_id')
        .eq('id', membership.user_id)
        .maybeSingle();

      if (userLookupError) return res.status(500).json({ error: 'No se pudo consultar el usuario' });
      if (!user?.supabase_auth_user_id) {
        return res.status(400).json({
          error: 'La cuenta activa no tiene un usuario de autenticacion vinculado'
        });
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        user.supabase_auth_user_id,
        { password: temporaryPassword }
      );

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }
    }

    await logAudit({
      eventId: membership.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'RESET_PASSWORD',
      entityType: 'ACCOUNT',
      entityId: membershipId,
      outcome: 'SUCCESS',
      reason: `Contrasena restablecida para codigo ${membership.participant_code}`,
    });

    return res.json({
      message: 'Contraseña restablecida correctamente',
      temporary_password: temporaryPassword,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
