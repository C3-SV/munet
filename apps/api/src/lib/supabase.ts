import { createClient } from "@supabase/supabase-js";

// Variables requeridas para inicializar clientes de Supabase.
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente privilegiado para backend (service role).
// Se usa en servicios/controladores para operaciones administrativas.
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

// Fábrica de cliente "anon" por request para flujo de login/password.
// Se usa para autenticar usuario final con signInWithPassword.
export const createAuthClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
