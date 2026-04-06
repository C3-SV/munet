import { create } from "zustand";
import { loginRequest } from "../lib/api/auth";
import type { AuthSession, AuthUser, LoginPayload } from "../types/auth";

type AuthState = {
  user: AuthUser | null;
  session: AuthSession | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  hydrateAuth: () => void;
  clearError: () => void;
};

const SESSION_KEY = "munet_session";
const TOKEN_KEY = "munet_token";
const USER_KEY = "munet_user";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  token: null,
  loading: false,
  error: null,

  login: async (payload) => {
    try {
      set({ loading: true, error: null });

      const data = await loginRequest(payload);

      localStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
      localStorage.setItem(TOKEN_KEY, data.session.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      set({
        user: data.user,
        session: data.session,
        token: data.session.access_token,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al iniciar sesión";

      set({
        loading: false,
        error: message,
      });

      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    set({
      user: null,
      session: null,
      token: null,
      loading: false,
      error: null,
    });
  },

  hydrateAuth: () => {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);

    const session = sessionRaw ? JSON.parse(sessionRaw) : null;
    const user = userRaw ? JSON.parse(userRaw) : null;

    set({
      session,
      token,
      user,
    });
  },

  clearError: () => set({ error: null }),
}));