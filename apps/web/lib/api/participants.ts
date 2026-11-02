import { requestApi } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ParticipantAccountStatus =
    | "PENDING_ACTIVATION"
    | "ACTIVE"
    | "SUSPENDED";

export type AdminParticipantProfile = {
    first_name: string;
    last_name: string;
    display_name: string | null;
    bio?: string | null;
    profile_image_path?: string | null;
};

export type AdminParticipant = {
    id: string;
    event_id: string;
    user_id: string;
    participant_code: string;
    role: string;
    committee_id: string | null;
    delegation_name: string | null;
    institution_name: string | null;
    account_status: ParticipantAccountStatus;
    status_changed_at?: string | null;
    created_at: string;
    profile: AdminParticipantProfile | null;
};

export type AdminParticipantPagination = {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
};

export type ParticipantMembership = {
    id: string;
    event_id: string;
    user_id: string;
    participant_code: string;
    role: string;
    committee_id: string | null;
    delegation_name: string | null;
    institution_name: string | null;
    account_status: ParticipantAccountStatus;
    status_changed_at?: string | null;
    created_at?: string | null;
};

export type ListParticipantsParams = {
    eventId: string;
    page?: number;
    limit?: number;
    committeeId?: string;
    role?: string;
    status?: ParticipantAccountStatus;
};

export type CreateAccountBody = {
    event_id: string;
    participant_code: string;
    role: string;
    committee_id?: string;
    delegation_name?: string;
    institution_name?: string;
    first_name: string;
    last_name: string;
    display_name?: string;
    bio?: string;
};

export type CreateAccountResponse = {
    message: string;
    user: Record<string, unknown>;
    membership: ParticipantMembership;
    profile: Record<string, unknown>;
    initial_password: string;
};

export type UpdateParticipantBody = {
    role?: string;
    committee_id?: string | null;
    delegation_name?: string | null;
    institution_name?: string | null;
    first_name?: string;
    last_name?: string;
    display_name?: string | null;
    bio?: string | null;
};

// ─── Participantes ────────────────────────────────────────────────────────────

// Lista los participantes del evento con filtros y paginación.
export const listParticipants = async (
    token: string,
    {
        eventId,
        page = 1,
        limit = 10,
        committeeId,
        role,
        status,
    }: ListParticipantsParams,
): Promise<{
    participants: AdminParticipant[];
    pagination: AdminParticipantPagination;
}> => {
    const params = new URLSearchParams({
        event_id: eventId,
        page: String(page),
        limit: String(limit),
    });

    if (committeeId) {
        params.set("committee_id", committeeId);
    }

    if (role?.trim()) {
        params.set("role", role.trim());
    }

    if (status) {
        params.set("status", status);
    }

    return requestApi(`/admin/participants?${params.toString()}`, {
        method: "GET",
        token,
    });
};

// Devuelve el detalle de un participante (membership + perfil).
export const getParticipant = async (
    token: string,
    membershipId: string,
): Promise<{ participant: AdminParticipant }> =>
    requestApi(`/admin/participants/${membershipId}`, {
        method: "GET",
        token,
    });

// Actualiza datos de membership y perfil de un participante.
// event_id y participant_code no son editables.
export const updateParticipant = async (
    token: string,
    membershipId: string,
    body: UpdateParticipantBody,
): Promise<{ message: string }> =>
    requestApi(`/admin/participants/${membershipId}`, {
        method: "PATCH",
        token,
        body,
    });

// Suspende la cuenta. El motivo es obligatorio en el backend.
export const suspendParticipant = async (
    token: string,
    membershipId: string,
    reason: string,
): Promise<{ message: string; membership: ParticipantMembership }> =>
    requestApi(`/admin/participants/${membershipId}/suspend`, {
        method: "POST",
        token,
        body: { reason },
    });

// Reactiva una cuenta suspendida. El motivo es obligatorio en el backend.
export const reactivateParticipant = async (
    token: string,
    membershipId: string,
    reason: string,
): Promise<{ message: string; membership: ParticipantMembership }> =>
    requestApi(`/admin/participants/${membershipId}/reactivate`, {
        method: "POST",
        token,
        body: { reason },
    });

// Genera una contraseña temporal. Se devuelve en texto plano una sola vez.
export const resetParticipantPassword = async (
    token: string,
    membershipId: string,
): Promise<{ message: string; temporary_password: string }> =>
    requestApi(`/admin/participants/${membershipId}/reset-password`, {
        method: "POST",
        token,
    });

// ─── Alta de cuentas ──────────────────────────────────────────────────────────

// Crea user + membership + profile. El servidor genera la contraseña inicial.
export const createAccount = async (
    token: string,
    body: CreateAccountBody,
): Promise<CreateAccountResponse> =>
    requestApi("/admin/create-account", {
        method: "POST",
        token,
        body,
    });
