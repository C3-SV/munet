import { supabaseAdmin } from '../lib/supabase';

// Payload minimo para dejar trazabilidad de intentos de autenticacion.
type AuthAttempt = {
  event_id?: string;
  participant_code?: string;
  event_membership_id?: string;
  attempt_type: 'LOGIN' | 'ACTIVATION';
  result: 'SUCCESS' | 'FAILURE';
  failure_reason?: string;
};

// Guarda intentos de login/activacion sin interrumpir el flujo principal si falla.
export const logAuthAttempt = async (data: AuthAttempt) => {
  try {
    await supabaseAdmin.from('auth_attempts').insert({
      ...data,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error logging auth attempt:', err);
  }
};
