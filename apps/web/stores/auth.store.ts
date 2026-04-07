import { create } from "zustand";
import { 
  authContextRequest, 
  loginRequest,
  validateActivationRequest,
  activateAccountRequest,
  type ActivateAccountPayload 
} from "../lib/api/auth";
import type {
  AuthSession,
  AuthUser,
  LoginPayload,
  MembershipSummary,
} from "../types/auth";

const SESSION_KEY = "munet_session";
const TOKEN_KEY = "munet_token";
const USER_KEY = "munet_user";
const MEMBERSHIPS_KEY = "munet_memberships";
const ACTIVE_EVENT_KEY = "munet_active_event";
const ACTIVE_MEMBERSHIP_KEY = "munet_active_membership";

const normalizeRole = (role: string | null | undefined) =>
  (role ?? "").trim().toUpperCase();

export const isAdminRole = (role: string | null | undefined) => {
  const normalized = normalizeRole(role);

  return (
    normalized.includes("ADMIN") ||
    normalized.includes("COORDINADOR") ||
    normalized.includes("ORGANIZADOR")
  );
};

const userNeedsEventSelection = (memberships: MembershipSummary[]) => {
  if (memberships.length === 0) {
    return true;
  }

  if (memberships.some((membership) => isAdminRole(membership.role))) {
    return true;
  }

  return false;
};

const resolveAutoMembership = (memberships: MembershipSummary[]) => {
  if (memberships.length === 0) {
    return null;
  }

  if (memberships.some((membership) => isAdminRole(membership.role))) {
    return null;
  }

  return memberships[0] ?? null;
};

type AuthState = {
  user: AuthUser | null;
  session: AuthSession | null;
  token: string | null;
  memberships: MembershipSummary[];
  activeEventId: string | null;
  activeMembershipId: string | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  hydrateAuth: () => void;
  clearError: () => void;
  needsEventSelection: () => boolean;
  setActiveMembership: (membershipId: string) => void;
  refreshContext: () => Promise<void>;
  validateActivation: (participantCode: string) => Promise<any[]>;
  activateAccount: (payload: ActivateAccountPayload) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  token: null,
  memberships: [],
  activeEventId: null,
  activeMembershipId: null,
  loading: false,
  hydrated: false,
  error: null,

  validateActivation: async (participantCode: string) => {
    try {
      set({ loading: true, error: null });
      const data = await validateActivationRequest(participantCode);
      set({ loading: false });
      return data.events || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al validar la cuenta";
      set({ loading: false, error: message });
      throw err;
    }
  },

  activateAccount: async (payload: ActivateAccountPayload) => {
    try {
      set({ loading: true, error: null });
      await activateAccountRequest(payload);
      set({ loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al activar la cuenta";
      set({ loading: false, error: message });
      throw err;
    }
  },

  login: async (payload) => {
    try {
      set({ loading: true, error: null });

      const data = await loginRequest(payload);

      const needsSelection = userNeedsEventSelection(data.memberships);
      const fallbackMembership = needsSelection ? null : data.memberships[0] ?? null;

      localStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
      localStorage.setItem(TOKEN_KEY, data.session.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(data.memberships));

      if (fallbackMembership) {
        localStorage.setItem(ACTIVE_EVENT_KEY, fallbackMembership.eventId);
        localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, fallbackMembership.id);
      } else {
        localStorage.removeItem(ACTIVE_EVENT_KEY);
        localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
      }

      set({
        user: data.user,
        session: data.session,
        token: data.session.access_token,
        memberships: data.memberships,
        activeEventId: fallbackMembership?.eventId ?? null,
        activeMembershipId: fallbackMembership?.id ?? null,
        loading: false,
        hydrated: true,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesion";

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
    localStorage.removeItem(MEMBERSHIPS_KEY);
    localStorage.removeItem(ACTIVE_EVENT_KEY);
    localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);

    set({
      user: null,
      session: null,
      token: null,
      memberships: [],
      activeEventId: null,
      activeMembershipId: null,
      loading: false,
      hydrated: true,
      error: null,
    });
  },

  hydrateAuth: () => {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const membershipsRaw = localStorage.getItem(MEMBERSHIPS_KEY);
    const activeEventId = localStorage.getItem(ACTIVE_EVENT_KEY);
    const activeMembershipId = localStorage.getItem(ACTIVE_MEMBERSHIP_KEY);

    const session = sessionRaw ? JSON.parse(sessionRaw) : null;
    const user = userRaw ? JSON.parse(userRaw) : null;
    const memberships = membershipsRaw ? (JSON.parse(membershipsRaw) as MembershipSummary[]) : [];
    const persistedMembership =
      activeMembershipId && memberships.find((membership) => membership.id === activeMembershipId)
        ? memberships.find((membership) => membership.id === activeMembershipId) ?? null
        : null;
    const autoMembership = resolveAutoMembership(memberships);
    const effectiveMembership = persistedMembership ?? autoMembership;

    set({
      session,
      token,
      user,
      memberships,
      activeEventId: effectiveMembership?.eventId ?? null,
      activeMembershipId: effectiveMembership?.id ?? null,
      hydrated: true,
    });

    if (effectiveMembership) {
      localStorage.setItem(ACTIVE_EVENT_KEY, effectiveMembership.eventId);
      localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, effectiveMembership.id);
    } else {
      localStorage.removeItem(ACTIVE_EVENT_KEY);
      localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
    }
  },

  clearError: () => set({ error: null }),

  needsEventSelection: () => {
    const state = get();

    if (!state.token) {
      return false;
    }

    if (state.activeEventId && state.activeMembershipId) {
      return false;
    }

    return userNeedsEventSelection(state.memberships);
  },

  setActiveMembership: (membershipId) => {
    const membership = get().memberships.find((item) => item.id === membershipId);

    if (!membership) {
      return;
    }

    localStorage.setItem(ACTIVE_EVENT_KEY, membership.eventId);
    localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, membership.id);

    set({
      activeEventId: membership.eventId,
      activeMembershipId: membership.id,
    });
  },

  refreshContext: async () => {
    const { token } = get();

    if (!token) {
      return;
    }

    const data = await authContextRequest(token);

    const currentMembership = get().activeMembershipId
      ? data.memberships.find((membership) => membership.id === get().activeMembershipId)
      : null;
    const autoMembership = resolveAutoMembership(data.memberships);
    const effectiveMembership = currentMembership ?? autoMembership ?? null;

    localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(data.memberships));

    if (effectiveMembership) {
      localStorage.setItem(ACTIVE_EVENT_KEY, effectiveMembership.eventId);
      localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, effectiveMembership.id);
    } else {
      localStorage.removeItem(ACTIVE_EVENT_KEY);
      localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
    }

    set({
      user: data.user,
      memberships: data.memberships,
      activeEventId: effectiveMembership?.eventId ?? null,
      activeMembershipId: effectiveMembership?.id ?? null,
    });
  },
}));
