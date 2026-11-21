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
    // supabase-js no lanza al fallar un insert: devuelve `{ error }`, que hay que revisar.
    const { error } = await supabaseAdmin.from('auth_attempts').insert({
      ...data,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error logging auth attempt:', {
        attemptType: data.attempt_type,
        result: data.result,
        error: error.message
      });
    }
  } catch (err) {
    console.error('Error logging auth attempt:', err);
  }
};
