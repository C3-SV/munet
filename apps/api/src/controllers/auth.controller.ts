import { supabase } from '../lib/supabase';
import { Request, Response } from 'express';

export const activateAccount = async (req: Request, res: Response) => {
    try {
        const { participant_code, event_id, password } = req.body;

        // 1. buscar membership
        const { data: membership, error: findError } = await supabase
            .from('event_memberships')
            .select('*')
            .eq('participant_code', participant_code)
            .eq('event_id', event_id)
            .single();

        if (findError || !membership) {
            return res.status(404).json({ error: 'Membership no encontrado' });
        }

        // 2. validar estado
        if (membership.account_status !== 'PENDING_ACTIVATION') {
            return res.status(400).json({ error: 'Cuenta ya activada o inválida' });
        }

        // 3. crear usuario en Supabase Auth
        const email = `${participant_code}@munet.local`;

        const { data: authData, error: authError } =
            await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        const authUserId = authData.user.id;

        // 4. insertar en tabla users
        const { error: userError } = await supabase
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
        await supabase
            .from('event_memberships')
            .update({
                account_status: 'ACTIVE',
                activated_at: new Date().toISOString()
            })
            .eq('id', membership.id);

        // 6. log intento (mínimo)
        await supabase.from('auth_attempts').insert({
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