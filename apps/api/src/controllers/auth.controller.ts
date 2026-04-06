import { Request, Response } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase';
import { getMembershipsByUserId } from '../services/auth-context.service';
import { logAuthAttempt } from '../utils/auth.logger';

export const activateAccount = async (req: Request, res: Response) => {
  try {
    const { participant_code, event_id, password } = req.body;

    // 1. buscar membership
    const { data: membership, error: findError } = await supabaseAdmin
      .from('event_memberships')
      .select('*')
      .eq('participant_code', participant_code)
      .eq('event_id', event_id)
      .single();

    if (findError || !membership) {
      await logAuthAttempt({
        event_id,
        participant_code,
        attempt_type: 'ACTIVATION',
        result: 'FAILURE',
        failure_reason: 'MEMBERSHIP_NOT_FOUND',
      });
      return res.status(404).json({ error: 'Membership no encontrado' });
    }

    // 2. validar estado
    if (membership.account_status !== 'PENDING_ACTIVATION') {
      await logAuthAttempt({
        event_id,
        participant_code,
        event_membership_id: membership.id,
        attempt_type: 'ACTIVATION',
        result: 'FAILURE',
        failure_reason: 'ALREADY_ACTIVATED',
      });
      return res.status(400).json({ error: 'Cuenta ya activada o invalida' });
    }

    // 3. crear usuario en Supabase Auth
    const email = `${participant_code}@munet.local`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      await logAuthAttempt({
        event_id,
        participant_code,
        event_membership_id: membership.id,
        attempt_type: 'ACTIVATION',
        result: 'FAILURE',
        failure_reason: authError.message,
      });
      return res.status(400).json({ error: authError.message });
    }

    const authUserId = authData.user.id;

    // 4. insertar en tabla users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        supabase_auth_user_id: authUserId,
        email,
      })
      .eq('id', membership.user_id);

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    // 5. actualizar membership
    await supabaseAdmin
      .from('event_memberships')
      .update({
        account_status: 'ACTIVE',
        activated_at: new Date().toISOString(),
      })
      .eq('id', membership.id);

    // 6. log intento
    await logAuthAttempt({
      event_id,
      participant_code,
      event_membership_id: membership.id,
      attempt_type: 'ACTIVATION',
      result: 'SUCCESS',
    });

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type LoginBody = {
  participant_code: string;
  password: string;
};

export const login = async (req: Request<{}, {}, LoginBody>, res: Response) => {
  try {
    const { participant_code, password } = req.body;

    if (!participant_code?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'participant_code y password son requeridos' });
    }

    // 1. buscar memberships activas por codigo participante
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('event_memberships')
      .select('id, event_id, user_id, account_status')
      .eq('participant_code', participant_code)
      .eq('account_status', 'ACTIVE');

    if (membershipsError || !memberships?.length) {
      await logAuthAttempt({
        participant_code,
        attempt_type: 'LOGIN',
        result: 'FAILURE',
        failure_reason: 'MEMBERSHIP_NOT_FOUND',
      });
      return res.status(400).json({ error: 'Membership no encontrado' });
    }

    const uniqueUserIds = [...new Set(memberships.map((membership) => membership.user_id))];

    if (uniqueUserIds.length > 1) {
      return res.status(409).json({
        error:
          'El participant_code esta asociado a multiples usuarios. Contacta a soporte para corregirlo.',
      });
    }

    // 2. obtener usuario
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', uniqueUserIds[0])
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'Usuario sin email' });
    }

    // 3. login con Supabase Auth
    const authClient = createAuthClient();

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError || !authData.session || !authData.user) {
      await logAuthAttempt({
        event_id: memberships[0]?.event_id,
        participant_code,
        event_membership_id: memberships[0]?.id,
        attempt_type: 'LOGIN',
        result: 'FAILURE',
        failure_reason: 'INVALID_CREDENTIALS',
      });
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    // 4. actualizar ultimo login
    await supabaseAdmin
      .from('event_memberships')
      .update({
        last_login_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('account_status', 'ACTIVE');

    // 5. obtener contexto de eventos
    const membershipContext = await getMembershipsByUserId(user.id);

    // 6. log intento
    await logAuthAttempt({
      event_id: memberships[0]?.event_id,
      participant_code,
      event_membership_id: memberships[0]?.id,
      attempt_type: 'LOGIN',
      result: 'SUCCESS',
    });

    return res.json({
      session: authData.session,
      user: authData.user,
      memberships: membershipContext,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

export const getAuthContext = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(req.auth.token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Sesion invalida' });
    }

    return res.json({
      user: data.user,
      memberships: req.auth.memberships,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo cargar el contexto de sesion' });
  }
};
