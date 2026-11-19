import { requestApi } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DirectoryContext = {
    token: string;
    eventId: string;
};

export type ParticipantDirectoryFilters = {
    q?: string;
    committeeId?: string;
    page: number;
    limit: number;
};

// Fila del directorio: solo campos públicos del participante. Nunca incluye código de acceso, correo ni datos de auth.
export type ParticipantDirectoryEntry = {
    membershipId: string;
    firstName: string;
    lastName: string;
    alias: string | null;
    committee: { id: string; name: string } | null;
    delegationCode: string | null;
};

export type ParticipantDirectoryResponse = {
    participants: ParticipantDirectoryEntry[];
    page: number;
    limit: number;
    hasMore: boolean;
};

// ─── Directorio ───────────────────────────────────────────────────────────────

// Lista paginada de participantes activos del evento; el filtro y la paginación los resuelve la API.
export const listParticipantDirectory = async (
    context: DirectoryContext,
    filters: ParticipantDirectoryFilters,
): Promise<ParticipantDirectoryResponse> => {
    const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
    });

    const q = filters.q?.trim();

    if (q) {
        params.set("q", q);
    }

    if (filters.committeeId) {
        params.set("committee_id", filters.committeeId);
    }

    return requestApi<ParticipantDirectoryResponse>(
        `/events/${context.eventId}/participants?${params.toString()}`,
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );
};
