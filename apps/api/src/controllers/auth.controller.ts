import { supabaseAdmin, createAuthClient } from '../lib/supabase';
import { Request, Response } from 'express';
import { logAuthAttempt } from '../utils/auth.logger';
import { AuthClient } from '@supabase/supabase-js';

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
                failure_reason: 'MEMBERSHIP_NOT_FOUND'
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
                failure_reason: 'ALREADY_ACTIVATED'
            });
            return res.status(400).json({ error: 'Cuenta ya activada o inválida' });
        }

        // 3. crear usuario en Supabase Auth
        const email = `${participant_code}@munet.local`;

        const { data: authData, error: authError } =
            await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

        if (authError) {
            await logAuthAttempt({
                event_id,
                participant_code,
                event_membership_id: membership.id,
                attempt_type: 'ACTIVATION',
                result: 'FAILURE',
                failure_reason: authError.message
            });
            return res.status(400).json({ error: authError.message });
        }

        const authUserId = authData.user.id;

        // 4. insertar en tabla users
        const { error: userError } = await supabaseAdmin
            .from('users')
            .update({
                supabase_auth_user_id: authUserId,
                email
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
                activated_at: new Date().toISOString()
            })
            .eq('id', membership.id);

        // 6. log intento (mínimo)
        await logAuthAttempt({
            event_id,
            participant_code,
            event_membership_id: membership.id,
            attempt_type: 'ACTIVATION',
            result: 'SUCCESS'
        });

        return res.json({ success: true });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error interno' });
    }
};

type LoginBody = {
    participant_code: string;
    event_id: string;
    password: string;
};

export const login = async (req: Request<{}, {}, LoginBody>, res: Response) => {
    try {
        const { participant_code, event_id, password } = req.body;

        // 1. buscar membership
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('event_memberships')
            .select('*')
            .eq('participant_code', participant_code)
            .eq('event_id', event_id)
            .single();

        if (membershipError || !membership) {
            await logAuthAttempt({
                event_id,
                participant_code,
                attempt_type: 'LOGIN',
                result: 'FAILURE',
                failure_reason: 'MEMBERSHIP_NOT_FOUND'
            });
            return res.status(400).json({ error: 'Membership no encontrado' });
        }

        // 2. validar que esté activo
        if (membership.account_status !== 'ACTIVE') {
            await logAuthAttempt({
                event_id,
                participant_code,
                event_membership_id: membership.id,
                attempt_type: 'LOGIN',
                result: 'FAILURE',
                failure_reason: 'ACCOUNT_NOT_ACTIVE'
            });
            return res.status(400).json({ error: 'Cuenta no activada' });
        }

        // 3. obtener usuario
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', membership.user_id)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (!user.email) {
            return res.status(400).json({ error: 'Usuario sin email' });
        }

        // 4. login con Supabase Auth
        const authClient = createAuthClient();

        const { data: authData, error: authError } =
            await authClient.auth.signInWithPassword({
                email: user.email,
                password
            });

        if (authError) {
            await logAuthAttempt({
                event_id,
                participant_code,
                event_membership_id: membership.id,
                attempt_type: 'LOGIN',
                result: 'FAILURE',
                failure_reason: 'INVALID_CREDENTIALS'
            });
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 5. actualizar último login
        await supabaseAdmin
            .from('event_memberships')
            .update({
                last_login_at: new Date().toISOString()
            })
            .eq('id', membership.id);

        // 6. log intento
        await logAuthAttempt({
            event_id,
            participant_code,
            event_membership_id: membership.id,
            attempt_type: 'LOGIN',
            result: 'SUCCESS'
        });

        return res.json({
            session: authData.session,
            user: authData.user
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error interno' });
    }
};