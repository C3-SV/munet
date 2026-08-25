import { requestApi } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AdminEvent = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    is_read_only: boolean;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
};

export type AdminCommittee = {
    id: string;
    event_id: string;
    name: string;
    code: string;
    description: string | null;
    sort_order: number;
    status: string;
    created_at: string;
};

export type CreateEventBody = {
    name: string;
    slug: string;
    description?: string;
    start_date?: string;
    end_date?: string;
};

export type CreateCommitteeBody = {
    event_id: string;
    name: string;
    code: string;
    description?: string;
    sort_order?: number;
};

// ─── Eventos ──────────────────────────────────────────────────────────────────

// Crea un evento nuevo. Requiere rol admin activo.
export const createEvent = async (
    token: string,
    body: CreateEventBody,
): Promise<{ message: string; event: AdminEvent }> =>
    requestApi("/admin/events", {
        method: "POST",
        token,
        body,
    });

// ─── Comités ──────────────────────────────────────────────────────────────────

// Crea un comité dentro de un evento. Requiere rol admin activo.
export const createCommittee = async (
    token: string,
    body: CreateCommitteeBody,
): Promise<{ message: string; committee: AdminCommittee }> =>
    requestApi("/admin/committees", {
        method: "POST",
        token,
        body,
    });
