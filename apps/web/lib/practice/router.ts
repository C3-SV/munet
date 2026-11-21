import type { ChatParticipant, ConversationSummary, DirectMessage } from "../../types/chat.ts";
import type { MyProfile, PostComment, PublicProfile } from "../../types/common.ts";
import type { ParticipantDirectoryResponse } from "../api/directory.ts";
import type { FeedResponse } from "../api/feed.ts";
import type { EventCommittee, EventWallsResponse } from "../api/events.ts";
import { buildPracticeWalls, PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_EVENT_ID, PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import type { PracticeComment, PracticeMessage, PracticePerson } from "./model.ts";
import type { PracticeState } from "./state.ts";
import {
    chatParticipantOf,
    findPerson,
    normalizeSearch,
    sortPostsForWall,
    toComment,
    toConversationSummary,
    toDirectMessage,
    toDirectoryEntry,
    toMyProfile,
    toPost,
    toPublicProfile,
} from "./views.ts";
import {
    PracticeRequestError,
    readableWallOrThrow,
    requireParam,
    visiblePostOrThrow,
    type PracticeRouteContext,
} from "./router-shared.ts";
import {
    handleAttachmentInit,
    handleAttachmentRemove,
    handlePollClose,
    handlePollVote,
    handlePostCreate,
    handlePostDelete,
} from "./router-posts.ts";
import { handleCommentCreate, handleCommentDelete } from "./router-comments.ts";
import { handleConversationCreate, handleMessageCreate, handleMessageDelete } from "./router-dm.ts";
import { handleAvatarUpload, handleProfileUpdate } from "./router-profile.ts";

// Los errores y el contexto de los manejadores viven en router-shared.ts; se reexportan desde aquí.
export { PracticeRequestError };
export type { PracticeRouteContext };

export const PRACTICE_UNAVAILABLE_MESSAGE = "No disponible en modo práctica";

export type PracticeRequest = {
    method: string;
    path: string;
    body?: unknown;
};

type Route = {
    method: string;
    // Segmentos ya decodificados: un literal se compara tal cual; ":nombre" captura un segmento no vacío.
    pattern: readonly string[];
    handle: (context: PracticeRouteContext) => unknown;
};

const unavailable = (): PracticeRequestError =>
    new PracticeRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE);

const DIRECTORY_DEFAULT_LIMIT = 20;
const DIRECTORY_MAX_LIMIT = 100;
// Como la API de DM: se leen como mucho 80 miembros y se devuelven 20 coincidencias.
const DM_SEARCH_READ_LIMIT = 80;
const DM_SEARCH_RESULT_LIMIT = 20;

const practiceCommittees = (state: PracticeState): EventCommittee[] =>
    PRACTICE_COMMITTEES.map((committee, index) => ({
        id: committee.id,
        event_id: PRACTICE_EVENT_ID,
        name: committee.name,
        code: committee.code,
        description: null,
        status: "ACTIVE",
        sort_order: index + 1,
        canAccess: committee.id === state.persona.committeeId,
    }));

// Orden ascendente por fecha de creación; Array.prototype.sort es estable, así que los empates conservan el orden del estado.
const byCreatedAt = <T extends { createdAt: string }>(items: readonly T[]): T[] =>
    [...items].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

const handleWalls = ({ state }: PracticeRouteContext): EventWallsResponse => {
    const { committeeId } = state.persona;
    return {
        event: { id: PRACTICE_EVENT_ID, name: "Práctica", slug: "practica" },
        membership: { id: PRACTICE_MEMBERSHIP_ID, role: "PARTICIPANT", committeeId },
        // Como la API real: solo se listan los muros a los que la persona tiene acceso.
        walls: buildPracticeWalls(committeeId).filter((wall) => wall.canAccess),
    };
};

const handleCommittees = ({ state }: PracticeRouteContext): { committees: EventCommittee[] } => ({
    committees: practiceCommittees(state),
});

const handleMyProfile = ({ state }: PracticeRouteContext): { profile: MyProfile } => ({
    profile: toMyProfile(state),
});

const handlePublicProfile = ({ params, state }: PracticeRouteContext): { profile: PublicProfile } => {
    const profile = toPublicProfile(state, requireParam(params, "membershipId"));
    if (profile === null) {
        throw new PracticeRequestError(404, "Perfil no encontrado");
    }
    return { profile };
};

// Sin ?muro= la API usa general. Un ?muro= vacío no coincide con ningún muro y responde 404, igual que la API.
const handlePosts = ({ query, state }: PracticeRouteContext): FeedResponse => {
    const slug = query.get("muro") ?? "general";
    const wall = readableWallOrThrow(state, slug, "No tienes acceso a este muro");
    const posts = sortPostsForWall(
        state.posts.filter((post) => post.wallSlug === wall.slug && !post.deleted),
    ).map((post) => toPost(state, post));
    return { wall, posts };
};

const handleComments = ({ params, state }: PracticeRouteContext): { comments: PostComment[] } => {
    const post = visiblePostOrThrow(state, requireParam(params, "postId"));
    readableWallOrThrow(state, post.wallSlug, "No tienes acceso a los comentarios de este post");
    const comments: PracticeComment[] = byCreatedAt(
        state.comments.filter((comment) => comment.postId === post.id && !comment.deleted),
    );
    return { comments: comments.map((comment) => toComment(state, comment)) };
};

// Texto de búsqueda de una persona en el directorio: nombre, apellido, nombre completo, alias y código sin "#".
const directoryTexts = (person: PracticePerson): string[] =>
    [
        person.firstName,
        person.lastName,
        `${person.firstName} ${person.lastName}`,
        person.alias ?? "",
        person.delegationCode.replace(/^#/, ""),
    ].map((text) => normalizeSearch(text).trim());

// Directorio: la propia persona, la cohorte y el personal (todas las membresías con perfil).
const directoryPeople = (state: PracticeState): PracticePerson[] => {
    const own = findPerson(state, PRACTICE_MEMBERSHIP_ID);
    return own === null ? [...state.people] : [own, ...state.people];
};

// Apellido, nombre y, por último, id. Comparación de texto con el locale español.
const byDirectoryOrder = (left: PracticePerson, right: PracticePerson): number => {
    const byLast = left.lastName.localeCompare(right.lastName, "es");
    if (byLast !== 0) {
        return byLast;
    }
    const byFirst = left.firstName.localeCompare(right.firstName, "es");
    if (byFirst !== 0) {
        return byFirst;
    }
    return left.membershipId < right.membershipId ? -1 : left.membershipId > right.membershipId ? 1 : 0;
};

// Entero de un parámetro de consulta: ausente usa el valor por defecto; si no es un entero dentro del rango, 400.
const parseIntegerParam = (raw: string | null, fallback: number, max: number, message: string): number => {
    if (raw === null) {
        return fallback;
    }
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > max) {
        throw new PracticeRequestError(400, message);
    }
    return value;
};

const handleDirectory = ({ query, state }: PracticeRouteContext): ParticipantDirectoryResponse => {
    const committeeId = query.get("committee_id");
    if (committeeId !== null && !PRACTICE_COMMITTEES.some((committee) => committee.id === committeeId)) {
        throw new PracticeRequestError(400, "committee_id no pertenece a este evento");
    }
    const page = parseIntegerParam(
        query.get("page"),
        1,
        Number.MAX_SAFE_INTEGER,
        "page debe ser un entero mayor o igual a 1",
    );
    const limit = parseIntegerParam(
        query.get("limit"),
        DIRECTORY_DEFAULT_LIMIT,
        DIRECTORY_MAX_LIMIT,
        `limit debe ser un entero entre 1 y ${DIRECTORY_MAX_LIMIT}`,
    );
    const term = normalizeSearch(query.get("q") ?? "").trim().replace(/^#/, "").trim();

    const matches = directoryPeople(state)
        .filter((person) => committeeId === null || person.committeeId === committeeId)
        .filter((person) => term === "" || directoryTexts(person).some((text) => text.includes(term)))
        .sort(byDirectoryOrder);

    const start = (page - 1) * limit;
    const end = start + limit;
    return {
        participants: matches.slice(start, end).map((person) => toDirectoryEntry(state, person)),
        page,
        limit,
        // Hay página siguiente si existe al menos una coincidencia más allá de la página actual.
        hasMore: matches.length > end,
    };
};

const handleConversations = ({ state }: PracticeRouteContext): { conversations: ConversationSummary[] } => ({
    conversations: state.conversations
        .map((conversation) => toConversationSummary(state, conversation))
        .sort((left, right) => {
            // Último mensaje descendente con los nulos al final; empate por fecha de creación descendente.
            if (left.lastMessageAt !== right.lastMessageAt) {
                if (left.lastMessageAt === null) {
                    return 1;
                }
                if (right.lastMessageAt === null) {
                    return -1;
                }
                return Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt);
            }
            return Date.parse(right.createdAt) - Date.parse(left.createdAt);
        }),
});

const handleMessages = ({ params, state }: PracticeRouteContext): { messages: DirectMessage[] } => {
    const conversationId = requireParam(params, "conversationId");
    const conversation = state.conversations.find((item) => item.id === conversationId);
    if (conversation === undefined) {
        throw new PracticeRequestError(404, "Conversacion no encontrada");
    }
    const messages: PracticeMessage[] = byCreatedAt(
        state.messages.filter((message) => message.conversationId === conversation.id && !message.deleted),
    );
    return { messages: messages.map(toDirectMessage) };
};

// Texto que busca el buscador de DM: nombre, comité, rol y delegación (sin alias).
const chatSearchText = (participant: ChatParticipant): string =>
    `${participant.name} ${participant.committee} ${participant.role} ${participant.delegationName ?? ""} ${participant.institutionName ?? ""}`;

const handleDmParticipants = ({ query, state }: PracticeRouteContext): { participants: ChatParticipant[] } => {
    const term = normalizeSearch(query.get("search") ?? "").trim();
    const participants = state.people
        .filter((person) => person.membershipId !== PRACTICE_MEMBERSHIP_ID)
        .slice(0, DM_SEARCH_READ_LIMIT)
        .map((person) => chatParticipantOf(state, person))
        .filter((participant) => term === "" || normalizeSearch(chatSearchText(participant)).includes(term))
        .slice(0, DM_SEARCH_RESULT_LIMIT);
    return { participants };
};

// Orden de la tabla: los literales van antes que los parámetros (p. ej. "profiles/me" antes que "profiles/:membershipId").
const ROUTES: readonly Route[] = [
    { method: "GET", pattern: ["events", PRACTICE_EVENT_ID, "walls"], handle: handleWalls },
    { method: "GET", pattern: ["events", PRACTICE_EVENT_ID, "committees"], handle: handleCommittees },
    { method: "GET", pattern: ["events", PRACTICE_EVENT_ID, "participants"], handle: handleDirectory },
    { method: "GET", pattern: ["profiles", "me"], handle: handleMyProfile },
    { method: "GET", pattern: ["profiles", ":membershipId"], handle: handlePublicProfile },
    { method: "GET", pattern: ["posts"], handle: handlePosts },
    { method: "GET", pattern: ["posts", ":postId", "comments"], handle: handleComments },
    { method: "GET", pattern: ["dm", "conversations"], handle: handleConversations },
    { method: "GET", pattern: ["dm", "conversations", ":conversationId", "messages"], handle: handleMessages },
    { method: "GET", pattern: ["dm", "participants"], handle: handleDmParticipants },
    { method: "POST", pattern: ["dm", "conversations"], handle: handleConversationCreate },
    { method: "POST", pattern: ["dm", "conversations", ":conversationId", "messages"], handle: handleMessageCreate },
    {
        method: "DELETE",
        pattern: ["dm", "conversations", ":conversationId", "messages", ":messageId"],
        handle: handleMessageDelete,
    },
    { method: "POST", pattern: ["posts"], handle: handlePostCreate },
    { method: "POST", pattern: ["posts", "attachments", "init"], handle: handleAttachmentInit },
    { method: "DELETE", pattern: ["posts", ":postId"], handle: handlePostDelete },
    { method: "DELETE", pattern: ["posts", ":postId", "attachment"], handle: handleAttachmentRemove },
    { method: "POST", pattern: ["posts", ":postId", "poll", "vote"], handle: handlePollVote },
    { method: "POST", pattern: ["posts", ":postId", "poll", "close"], handle: handlePollClose },
    { method: "POST", pattern: ["posts", ":postId", "comments"], handle: handleCommentCreate },
    { method: "DELETE", pattern: ["posts", ":postId", "comments", ":commentId"], handle: handleCommentDelete },
    { method: "PATCH", pattern: ["profiles", "me"], handle: handleProfileUpdate },
    { method: "POST", pattern: ["profiles", "me", "avatar"], handle: handleAvatarUpload },
];

// Separa la ruta en segmentos decodificados y su consulta. Devuelve null si la ruta
// no tiene forma válida (sin barra inicial o con un escape mal formado).
const parsePath = (rawPath: string): { segments: string[]; query: URLSearchParams } | null => {
    const queryStart = rawPath.indexOf("?");
    const pathname = queryStart === -1 ? rawPath : rawPath.slice(0, queryStart);
    const query = new URLSearchParams(queryStart === -1 ? "" : rawPath.slice(queryStart + 1));
    const trimmed = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    if (!trimmed.startsWith("/")) {
        return null;
    }
    try {
        // Se separa antes de decodificar: un %2F dentro de un identificador no crea segmentos.
        const segments = trimmed.slice(1).split("/").map((segment) => decodeURIComponent(segment));
        return { segments, query };
    } catch {
        return null;
    }
};

// Compara los segmentos uno a uno. Devuelve los parámetros capturados, o null si el patrón no encaja.
const matchPattern = (
    pattern: readonly string[],
    segments: readonly string[],
): Record<string, string> | null => {
    if (pattern.length !== segments.length) {
        return null;
    }
    const params: Record<string, string> = {};
    for (let index = 0; index < pattern.length; index += 1) {
        const expected = pattern[index];
        const actual = segments[index];
        if (expected === undefined || actual === undefined) {
            return null;
        }
        if (expected.startsWith(":")) {
            if (actual === "") {
                return null;
            }
            params[expected.slice(1)] = actual;
        } else if (expected !== actual) {
            return null;
        }
    }
    return params;
};

// Resultado de una petición: la respuesta, los ids de binarios liberados y si alguna escritura cambió el estado.
export type PracticeOutcome = {
    result: unknown;
    released: string[];
    wrote: boolean;
    // Solo lo fijan algunos manejadores (creación de conversaciones y mensajes); el resto queda sin valor.
    status?: number;
};

// Enrutador síncrono y sin red: atiende solo los caminos de la tabla y falla cerrado con 501 en el resto.
// Las escrituras mutan `state` (que la pasarela conserva); cada una valida antes de tocar nada.
export const routePracticeRequestDetailed = (
    request: PracticeRequest,
    state: PracticeState,
    options?: { now?: Date },
): PracticeOutcome => {
    const method = request.method.toUpperCase();
    const parsed = parsePath(request.path);
    if (parsed === null) {
        throw unavailable();
    }
    for (const route of ROUTES) {
        if (route.method !== method) {
            continue;
        }
        const params = matchPattern(route.pattern, parsed.segments);
        if (params !== null) {
            const context: PracticeRouteContext = {
                params,
                query: parsed.query,
                body: request.body,
                state,
                now: options?.now ?? new Date(),
                released: [],
                wrote: false,
            };
            const result = route.handle(context);
            return { result, released: context.released, wrote: context.wrote, status: context.status };
        }
    }
    throw unavailable();
};

// Igual que routePracticeRequestDetailed, pero devuelve solo la respuesta.
export const routePracticeRequest = (
    request: PracticeRequest,
    state: PracticeState,
    options?: { now?: Date },
): unknown => routePracticeRequestDetailed(request, state, options).result;
