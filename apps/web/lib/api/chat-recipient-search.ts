import type { ChatParticipant } from "../../types/chat";
import type { ParticipantDirectoryEntry } from "./directory";

// Tamaño de la página que pide el buscador de destinatarios; la API admite hasta 100 filas.
export const RECIPIENT_DIRECTORY_LIMIT = 50;

// "idle": sin comité ni texto, se muestra el inbox. "dm": búsqueda por texto vigente.
// "directory": comité seleccionado, se usa el directorio filtrado por comité y texto.
export type RecipientSearchMode = "idle" | "dm" | "directory";

export const resolveRecipientSearchMode = (input: {
    query: string;
    committeeId: string;
}): RecipientSearchMode => {
    if (input.committeeId) {
        return "directory";
    }

    if (input.query.trim()) {
        return "dm";
    }

    return "idle";
};

// Identifica el contexto de una búsqueda. Cualquier cambio de evento, comité o texto produce otra clave.
export const buildRecipientSearchKey = (input: {
    eventId: string | null;
    query: string;
    committeeId: string;
}): string => {
    const mode = resolveRecipientSearchMode(input);

    if (mode === "idle" || !input.eventId) {
        return "";
    }

    return JSON.stringify([input.eventId, mode, input.committeeId, input.query.trim()]);
};

// Resultado de una petición ya resuelta, etiquetado con la clave del contexto que la originó.
export type RecipientSearchResult = {
    key: string;
    status: "ready" | "error";
    participants: ChatParticipant[];
    hasMore: boolean;
    error: string | null;
};

export type RecipientSearchView = {
    status: "idle" | "loading" | "ready" | "error";
    participants: ChatParticipant[];
    hasMore: boolean;
    error: string | null;
};

// Solo se muestra un resultado si pertenece al contexto actual; cualquier otro cuenta como pendiente.
export const resolveRecipientSearchView = (
    currentKey: string,
    result: RecipientSearchResult | null,
): RecipientSearchView => {
    if (!currentKey) {
        return { status: "idle", participants: [], hasMore: false, error: null };
    }

    if (!result || result.key !== currentKey) {
        return { status: "loading", participants: [], hasMore: false, error: null };
    }

    return {
        status: result.status,
        participants: result.participants,
        hasMore: result.hasMore,
        error: result.error,
    };
};

// Quita la membresía autenticada de los destinatarios posibles.
export const excludeOwnRecipient = (
    participants: ChatParticipant[],
    activeMembershipId: string | null,
): ChatParticipant[] => {
    if (!activeMembershipId) {
        return participants;
    }

    return participants.filter((participant) => participant.id !== activeMembershipId);
};

// Convierte una fila del directorio público al formato que usa la lista de chat.
export const directoryEntryToRecipient = (entry: ParticipantDirectoryEntry): ChatParticipant => {
    const fullName = [entry.firstName, entry.lastName]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join(" ");

    return {
        id: entry.membershipId,
        name: fullName || entry.alias?.trim() || "Participante",
        alias: entry.alias?.trim() || null,
        // Foto del directorio; si falla al cargar, la lista dibuja iniciales.
        avatar: entry.avatar ?? "",
        role: "Delegado",
        committee: entry.committee?.name ?? "Sin comité",
        lastActive: "Activo",
        delegationName: entry.delegationCode,
        institutionName: null,
    };
};

// Iniciales para avatares sin imagen: primera letra de las dos primeras palabras.
export const buildInitials = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
