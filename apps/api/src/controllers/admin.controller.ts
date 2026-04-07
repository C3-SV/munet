import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../utils/audit.logger';
import bcrypt from 'bcrypt';

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
  initial_password: string;
};

export const createAccount = async (
  req: Request<{}, {}, CreateAccountBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const {
      event_id,
      participant_code,
      role,
      committee_id,
      delegation_name,
      institution_name,
      first_name,
      last_name,
      display_name,
      bio,
      initial_password
    } = req.body;

    if (
      !event_id ||
      !participant_code ||
      !role ||
      !first_name ||
      !last_name ||
      !initial_password
    ) {
      return res.status(400).json({
        error:
          'event_id, participant_code, role, first_name, last_name e initial_password son requeridos'
      });
    }

    // 1. validar que no exista el código
    const { data: existing } = await supabaseAdmin
      .from('event_memberships')
      .select('id')
      .eq('participant_code', participant_code)
      .eq('event_id', event_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Código ya existe' });
    }

    // 2. validar committee_id
    if (committee_id) {
      const { data: committee } = await supabaseAdmin
        .from('committees')
        .select('id, event_id')
        .eq('id', committee_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!committee) {
        return res.status(404).json({ error: 'Comité no encontrado' });
      }

      if (committee.event_id !== event_id) {
        return res.status(400).json({
          error: 'El comité no pertenece al evento indicado'
        });
      }
    }

    // 3. crear user vacío
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      .select()
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: 'Error creando user' });
    }

    // 4. hashear contraseña inicial
    const initialPasswordHash = await bcrypt.hash(initial_password, 10);

    // 5. crear membership
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('event_memberships')
      .insert({
        event_id,
        user_id: user.id,
        participant_code,
        role,
        committee_id: committee_id ?? null,
        delegation_name,
        institution_name,
        account_status: 'PENDING_ACTIVATION',
        status_changed_at: new Date().toISOString(),
        initial_password_hash: initialPasswordHash,
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      .select()
      .single();

    if (membershipError || !membership) {
      return res.status(400).json({
        error: membershipError?.message || 'Error creando membership'
      });
    }

    // 6. crear profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        event_membership_id: membership.id,
        first_name,
        last_name,
        display_name: display_name ?? null,
        bio: bio ?? null,
        profile_image_path: null,
        updated_by_membership_id: membership.id,
      })
      .select()
      .single();

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    await logAudit({
      eventId: event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'CREATE_ACCOUNT',
      entityType: 'ACCOUNT',
      entityId: membership.id,
      outcome: 'SUCCESS',
      reason: `Cuenta creada con codigo ${participant_code} y rol ${role}`,
    });

    return res.json({
      message: 'Cuenta creada correctamente',
      user,
      membership,
      profile
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

export const createEvent = async (
  req: Request<{}, {}, CreateEventBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { name, slug, description, start_date, end_date } = req.body;

    // 1. validaciones básicas
    if (!name || !slug) {
      return res.status(400).json({ error: 'name y slug son requeridos' });
    }

    // 2. validar slug único
    const { data: existing } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

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

type CreateMembershipBody = {
  event_id: string;
  user_id: string;
  participant_code: string;
  role: string;
  committee_id?: string;
  delegation_name?: string;
  institution_name?: string;
};

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

    return res.json({
      message: 'Membership creada correctamente',
      membership
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

export const createCommittee = async (
  req: Request<{}, {}, CreateCommitteeBody>,
  res: Response
) => {
  try {
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
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, status')
      .eq('id', event_id)
      .is('deleted_at', null)
      .maybeSingle();

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
    const { data: existingName } = await supabaseAdmin
      .from('committees')
      .select('id')
      .eq('event_id', event_id)
      .eq('name', name)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingName) {
      return res.status(400).json({
        error: 'Ya existe un comité con ese nombre en este evento'
      });
    }

    // 3. validar unicidad del code dentro del evento
    const { data: existingCode } = await supabaseAdmin
      .from('committees')
      .select('id')
      .eq('event_id', event_id)
      .eq('code', code)
      .is('deleted_at', null)
      .maybeSingle();

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

    await logAudit({
      eventId: event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'CREATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committee.id,
      outcome: 'SUCCESS',
      reason: `Comite creado: ${name} (${code})`,
    });

    return res.json({
      message: 'Comité creado correctamente',
      committee
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

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
