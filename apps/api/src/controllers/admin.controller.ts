import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';

type CreateAccountBody = {
  event_id: string;
  participant_code: string;
  role: string;
  committee_id?: string;
  delegation_name?: string;
  institution_name?: string;
};

export const createAccount = async (
  req: Request<{}, {}, CreateAccountBody>,
  res: Response
) => {
  try {
    const {
      event_id,
      participant_code,
      role,
      committee_id,
      delegation_name,
      institution_name
    } = req.body;

    if (!event_id || !participant_code || !role) {
      return res.status(400).json({
        error: 'event_id, participant_code y role son requeridos'
      });
    }

    // 1. validar que no exista el código
    const { data: existing } = await supabaseAdmin
      .from('event_memberships')
      .select('id')
      .eq('participant_code', participant_code)
      .eq('event_id', event_id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Código ya existe' });
    }

    // validar el commimte id
    if (committee_id) {
      const { data: committee } = await supabaseAdmin
        .from('committees')
        .select('id, event_id')
        .eq('id', committee_id)
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

    // 2. crear user vacío
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({})
      .select()
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: 'Error creando user' });
    }

    // 3. crear membership
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
        status_changed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (membershipError) {
      return res.status(400).json({ error: membershipError.message });
    }

    return res.json({
      message: 'Cuenta creada correctamente',
      user,
      membership
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
        status: 'DRAFT',
        is_read_only: false
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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
        status_changed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      message: 'Comité creado correctamente',
      committee
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};