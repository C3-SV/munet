import { create } from "zustand";
import { 
  authContextRequest, 
  AuthRequestError,
  loginRequest,
  validateActivationRequest,
  activateAccountRequest,
  type ActivateAccountPayload,
  type ActivationEvent,
} from "../lib/api/auth";
import { PRACTICE_EVENT_ID, PRACTICE_MEMBERSHIP_ID } from "../lib/practice/constants";
import {
  shouldPersistActive,
  withoutPracticeMembership,
  withPracticeMembership,
} from "../lib/practice/membership";
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

// Normaliza roles para reglas de ruteo y permisos en frontend.
const normalizeRole = (role: string | null | undefined) =>
  (role ?? "").trim().toUpperCase();

// Identifica membresias administrativas (los dos administradores del enum de la base).
export const isAdminRole = (role: string | null | undefined) => {
  const normalized = normalizeRole(role);

  return normalized === "ADMIN_MUN" || normalized === "ADMIN_TECH";
};

// El rol de moderador se compara por valor exacto para no ampliar privilegios.
export const isModeratorRole = (role: string | null | undefined) =>
  normalizeRole(role) === "MODERATOR";

// Quien puede entrar al panel: administradores o moderadores del evento.
export const canAccessAdminPanel = (role: string | null | undefined) =>
  isAdminRole(role) || isModeratorRole(role);

// Solo el equipo técnico crea eventos (ADR-005); se evalúa sobre membresías activas.
export const isSuperAdminMembership = (
  membership: Pick<MembershipSummary, "role" | "accountStatus">,
) =>
  normalizeRole(membership.role) === "ADMIN_TECH" &&
  normalizeRole(membership.accountStatus) === "ACTIVE";

// Regla central: solo admins pasan por select-event de forma obligatoria.
const userNeedsEventSelection = (memberships: MembershipSummary[]) => {
  if (memberships.length === 0) {
    return true;
  }

  if (memberships.some((membership) => isAdminRole(membership.role))) {
    return true;
  }

  return false;
};

// Para delegados se auto-selecciona su unica membership.
const resolveAutoMembership = (memberships: MembershipSummary[]) => {
  if (memberships.length === 0) {
    return null;
  }

  if (memberships.some((membership) => isAdminRole(membership.role))) {
    return null;
  }

  return memberships[0] ?? null;
};

// Estado HTTP del ultimo error de auth (null si no es un error de API).
const errorStatusOf = (err: unknown) =>
  err instanceof AuthRequestError ? err.status : null;

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
  errorStatus: number | null;
  // Modo práctica: solo en memoria, nunca se persiste.
  practice: boolean;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  hydrateAuth: () => void;
  clearError: () => void;
  needsEventSelection: () => boolean;
  setActiveMembership: (membershipId: string) => void;
  refreshContext: () => Promise<void>;
  enterPractice: () => void;
  exitPractice: () => void;
  validateActivation: (participantCode: string) => Promise<ActivationEvent[]>;
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
  errorStatus: null,
  practice: false,

  // Valida si el codigo tiene cuentas pendientes de activacion.
  validateActivation: async (participantCode: string) => {
    try {
      set({ loading: true, error: null, errorStatus: null });
      const data = await validateActivationRequest(participantCode);
      set({ loading: false });
      return data.events || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al validar la cuenta";
      set({ loading: false, error: message, errorStatus: errorStatusOf(err) });
      throw err;
    }
  },

  // Completa activacion inicial con password temporal + password nueva.
  activateAccount: async (payload: ActivateAccountPayload) => {
    try {
      set({ loading: true, error: null, errorStatus: null });
      await activateAccountRequest(payload);
      set({ loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al activar la cuenta";
      set({ loading: false, error: message, errorStatus: errorStatusOf(err) });
      throw err;
    }
  },

  // Login principal: persiste sesion y decide si requiere selector de evento.
  login: async (payload) => {
    try {
      set({ loading: true, error: null, errorStatus: null });

      const data = await loginRequest(payload);
      // La membresía de práctica nunca se toma del API ni se persiste.
      const memberships = withoutPracticeMembership(data.memberships);

      const needsSelection = userNeedsEventSelection(memberships);
      const fallbackMembership = needsSelection ? null : memberships[0] ?? null;

      localStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
      localStorage.setItem(TOKEN_KEY, data.session.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships));

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
        memberships,
        practice: false,
        activeEventId: fallbackMembership?.eventId ?? null,
        activeMembershipId: fallbackMembership?.id ?? null,
        loading: false,
        hydrated: true,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";

      set({
        loading: false,
        error: message,
        errorStatus: errorStatusOf(err),
      });

      throw err;
    }
  },

  // Limpia sesion local completa y reinicia estado en memoria.
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
      practice: false,
      activeEventId: null,
      activeMembershipId: null,
      loading: false,
      hydrated: true,
      error: null,
    });
  },

  // Restaura sesion desde localStorage al iniciar la app.
  hydrateAuth: () => {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const membershipsRaw = localStorage.getItem(MEMBERSHIPS_KEY);
    const activeMembershipId = localStorage.getItem(ACTIVE_MEMBERSHIP_KEY);

    const session = sessionRaw ? JSON.parse(sessionRaw) : null;
    const user = userRaw ? JSON.parse(userRaw) : null;
    // La práctica no se restaura: si localStorage trajera sus ids, se descartan aquí.
    const memberships = membershipsRaw
      ? withoutPracticeMembership(JSON.parse(membershipsRaw) as MembershipSummary[])
      : [];
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
      practice: false,
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

  clearError: () => set({ error: null, errorStatus: null }),

  // Expone regla reutilizable para guards de rutas.
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

  // Cambia contexto activo de evento/membership y lo persiste.
  setActiveMembership: (membershipId) => {
    const membership = get().memberships.find((item) => item.id === membershipId);

    if (!membership) {
      return;
    }

    // La práctica cambia solo el estado en memoria; no se escribe en localStorage.
    if (shouldPersistActive(membership)) {
      localStorage.setItem(ACTIVE_EVENT_KEY, membership.eventId);
      localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, membership.id);
    }

    set({
      activeEventId: membership.eventId,
      activeMembershipId: membership.id,
    });
  },

  // Refresca memberships desde API manteniendo membership activa si sigue valida.
  refreshContext: async () => {
    const { token } = get();

    if (!token) {
      return;
    }

    const data = await authContextRequest(token);
    // Se lee el modo después de la petición: pudo cambiar mientras se esperaba la respuesta.
    const { practice } = get();
    // La membresía de práctica nunca se toma del API ni se persiste.
    const memberships = withoutPracticeMembership(data.memberships);

    localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships));

    if (practice) {
      // En práctica el contexto se conserva solo en memoria. Las claves locales no se tocan:
      // siguen apuntando a la última membresía real.
      set({
        user: data.user,
        memberships: withPracticeMembership(memberships),
        activeEventId: PRACTICE_EVENT_ID,
        activeMembershipId: PRACTICE_MEMBERSHIP_ID,
      });
      return;
    }

    const currentMembership = get().activeMembershipId
      ? memberships.find((membership) => membership.id === get().activeMembershipId)
      : null;
    const autoMembership = resolveAutoMembership(memberships);
    const effectiveMembership = currentMembership ?? autoMembership ?? null;

    if (effectiveMembership) {
      localStorage.setItem(ACTIVE_EVENT_KEY, effectiveMembership.eventId);
      localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, effectiveMembership.id);
    } else {
      localStorage.removeItem(ACTIVE_EVENT_KEY);
      localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
    }

    set({
      user: data.user,
      memberships,
      activeEventId: effectiveMembership?.eventId ?? null,
      activeMembershipId: effectiveMembership?.id ?? null,
    });
  },

  // Entra al modo práctica. Solo cambia el estado en memoria: no toca localStorage ni la red.
  enterPractice: () => {
    set({
      practice: true,
      memberships: withPracticeMembership(get().memberships),
      activeEventId: PRACTICE_EVENT_ID,
      activeMembershipId: PRACTICE_MEMBERSHIP_ID,
    });
  },

  // Sale de la práctica y restaura el contexto real: la membresía guardada si sigue siendo
  // válida, o la regla automática. Si no hay ninguna, el contexto activo queda en null.
  exitPractice: () => {
    const memberships = withoutPracticeMembership(get().memberships);
    const storedMembershipId = localStorage.getItem(ACTIVE_MEMBERSHIP_KEY);
    const storedMembership = storedMembershipId
      ? memberships.find((membership) => membership.id === storedMembershipId) ?? null
      : null;
    const effectiveMembership = storedMembership ?? resolveAutoMembership(memberships);

    if (effectiveMembership) {
      localStorage.setItem(ACTIVE_EVENT_KEY, effectiveMembership.eventId);
      localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, effectiveMembership.id);
    } else {
      localStorage.removeItem(ACTIVE_EVENT_KEY);
      localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
    }

    set({
      practice: false,
      memberships,
      activeEventId: effectiveMembership?.eventId ?? null,
      activeMembershipId: effectiveMembership?.id ?? null,
    });
  },
}));
