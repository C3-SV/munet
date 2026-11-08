import { requestApi } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AdminEventStatus = "ACTIVE" | "CLOSED" | "ARCHIVED";

export type AdminEvent = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: AdminEventStatus;
    is_read_only: boolean;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
};

export type AdminEventPagination = {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
};

export type AdminCommittee = {
    id: string;
    event_id: string;
    name: string;
    code: string;
    description: string | null;
    sort_order: number;
    status: string;
    created_at?: string | null;
};

export type CreateEventBody = {
    name: string;
    slug: string;
    description?: string;
    start_date?: string;
    end_date?: string;
};

export type UpdateEventBody = {
    name?: string;
    slug?: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    status?: AdminEventStatus;
};

export type CreateCommitteeBody = {
    event_id: string;
    name: string;
    code: string;
    description?: string;
    sort_order?: number;
};

export type UpdateCommitteeBody = {
    name?: string;
    code?: string;
    description?: string | null;
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

// Lista los eventos no eliminados con paginación.
export const listEvents = async (
    token: string,
    { page = 1, limit = 10 }: { page?: number; limit?: number } = {},
): Promise<{ events: AdminEvent[]; pagination: AdminEventPagination }> =>
    requestApi(`/admin/events?page=${page}&limit=${limit}`, {
        method: "GET",
        token,
    });

// Devuelve el detalle de un evento.
export const getEvent = async (
    token: string,
    eventId: string,
): Promise<{ event: AdminEvent }> =>
    requestApi(`/admin/events/${eventId}`, {
        method: "GET",
        token,
    });

// Actualiza campos parciales de un evento.
export const updateEvent = async (
    token: string,
    eventId: string,
    body: UpdateEventBody,
): Promise<{ message: string; event: AdminEvent }> =>
    requestApi(`/admin/events/${eventId}`, {
        method: "PATCH",
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

// Lista los comités de un evento desde la vista administrativa.
export const listCommittees = async (
    token: string,
    eventId: string,
): Promise<AdminCommittee[]> => {
    const payload = await requestApi<{ committees: AdminCommittee[] }>(
        `/admin/committees?event_id=${encodeURIComponent(eventId)}`,
        {
            method: "GET",
            token,
        },
    );

    return payload.committees;
};

// Devuelve el detalle de un comité.
export const getCommittee = async (
    token: string,
    committeeId: string,
): Promise<{ committee: AdminCommittee }> =>
    requestApi(`/admin/committees/${committeeId}`, {
        method: "GET",
        token,
    });

// Actualiza campos parciales de un comité y sincroniza su muro en backend.
export const updateCommittee = async (
    token: string,
    committeeId: string,
    body: UpdateCommitteeBody,
): Promise<{ message: string; committee: AdminCommittee }> =>
    requestApi(`/admin/committees/${committeeId}`, {
        method: "PATCH",
        token,
        body,
    });
