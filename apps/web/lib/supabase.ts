import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const realtimeEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseBrowser = realtimeEnabled
    ? createClient(supabaseUrl!, supabaseAnonKey!, {
          auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
          },
      })
    : null;
