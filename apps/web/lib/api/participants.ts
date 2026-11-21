import { requestApi } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ParticipantAccountStatus =
    | "PENDING_ACTIVATION"
    | "ACTIVE"
    | "SUSPENDED";

export type ParticipantImportRole = "PARTICIPANT" | "MODERATOR";

export type AdminParticipantProfile = {
    first_name: string;
    last_name: string;
    display_name: string | null;
    alias: string | null;
    bio?: string | null;
    profile_image_path?: string | null;
};

export type AdminParticipant = {
    id: string;
    event_id: string;
    user_id: string;
    participant_code: string;
    delegation_code: string | null;
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
    delegation_code?: string | null;
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
    q?: string;
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
    alias?: string;
};

export type CreateAccountResponse = {
    message: string;
    user: Record<string, unknown>;
    membership: ParticipantMembership;
    profile: Record<string, unknown>;
    initial_password: string;
    delegation_code: string | null;
    warnings: string[];
};

export type UpdateParticipantBody = {
    role?: string;
    committee_id?: string | null;
    delegation_name?: string | null;
    institution_name?: string | null;
    first_name?: string;
    last_name?: string;
    display_name?: string | null;
    alias?: string | null;
    bio?: string | null;
};

export type ChangeParticipantCommitteeResponse = {
    message: string;
    membership: {
        id: string;
        event_id: string;
        committee_id: string | null;
    };
    committee: { id: string; name: string | null } | null;
};

export type ParticipantImportRow = {
    row: number;
    first_name: string;
    last_name: string;
    participant_code: string;
    committee_id: string | null;
    committee_label: string | null;
    delegation_name: string | null;
    institution_name: string | null;
    role: ParticipantImportRole;
    alias: string | null;
};

export type ParticipantImportInvalidRow = {
    row: number;
    values: Record<string, string>;
    errors: string[];
};

export type ParticipantImportDuplicateRow = {
    row: number;
    values: Record<string, string>;
    participant_code: string;
    reason: "IN_FILE" | "IN_EVENT";
};

export type ParticipantImportPreview = {
    total_rows: number;
    valid: ParticipantImportRow[];
    invalid: ParticipantImportInvalidRow[];
    duplicates: ParticipantImportDuplicateRow[];
    template_headers: string[];
    limits: { max_rows: number; confirm_batch_max: number };
};

export type ParticipantImportCreatedRow = {
    row: number;
    membership_id: string;
    participant_code: string;
    delegation_code: string | null;
    first_name: string;
    last_name: string;
    role: ParticipantImportRole;
    committee_label: string | null;
    alias: string | null;
    initial_password: string;
    warnings: string[];
};

export type ParticipantImportFailedRow = {
    row: number;
    participant_code: string | null;
    errors: string[];
};

export type ParticipantImportConfirmResponse = {
    message: string;
    summary: { requested: number; created: number; failed: number };
    created: ParticipantImportCreatedRow[];
    failed: ParticipantImportFailedRow[];
};

// ─── Participantes ────────────────────────────────────────────────────────────

// Lista los participantes del evento con búsqueda, filtros y paginación.
export const listParticipants = async (
    token: string,
    {
        eventId,
        q,
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

    if (q?.trim()) {
        params.set("q", q.trim());
    }

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

// Da o quita el rol de moderador (S3-04). Solo admite PARTICIPANT o MODERATOR.
export const changeParticipantRole = (
    token: string,
    membershipId: string,
    role: "PARTICIPANT" | "MODERATOR",
    reason?: string,
): Promise<{ message: string; membership: ParticipantMembership }> =>
    requestApi(`/admin/participants/${membershipId}/role`, {
        method: "PATCH",
        token,
        body: { role, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
    });

// Cambia el comité mediante el endpoint específico de S2-08.
export const changeParticipantCommittee = async (
    token: string,
    membershipId: string,
    committeeId: string | null,
    reason?: string,
): Promise<ChangeParticipantCommitteeResponse> =>
    requestApi(`/admin/participants/${membershipId}/committee`, {
        method: "PATCH",
        token,
        body: {
            committee_id: committeeId,
            ...(reason?.trim() ? { reason: reason.trim() } : {}),
        },
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

// ─── Importación CSV ─────────────────────────────────────────────────────────

// Valida el texto de un CSV sin escribir nada.
export const previewParticipantImport = async (
    token: string,
    eventId: string,
    csv: string,
): Promise<ParticipantImportPreview> =>
    requestApi("/admin/participants/import/preview", {
        method: "POST",
        token,
        body: { event_id: eventId, csv },
    });

// Confirma un lote de hasta 50 filas validadas por el preview.
export const confirmParticipantImport = async (
    token: string,
    eventId: string,
    rows: ParticipantImportRow[],
): Promise<ParticipantImportConfirmResponse> =>
    requestApi("/admin/participants/import/confirm", {
        method: "POST",
        token,
        body: { event_id: eventId, rows },
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
