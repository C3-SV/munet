import type { ConversationSummary } from "../../types/chat.ts";
import type { MyProfile } from "../../types/common.ts";
import type { FeedResponse } from "../api/feed.ts";
import type { EventCommittee, EventWallsResponse } from "../api/events.ts";
import { buildPracticeWalls, PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_EVENT_ID, PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { avatarFor, type PracticeState } from "./state.ts";

// Error de la práctica con el estado HTTP que la capa de peticiones debe devolver.
export class PracticeRequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "PracticeRequestError";
        this.status = status;
    }
}

export const PRACTICE_UNAVAILABLE_MESSAGE = "No disponible en modo práctica";

export type PracticeRequest = {
    method: string;
    path: string;
    body?: unknown;
};

type RouteInput = {
    query: URLSearchParams;
    state: PracticeState;
};

type Route = {
    method: "GET";
    // Segmentos literales ya decodificados, comparados uno a uno.
    segments: readonly string[];
    handle: (input: RouteInput) => unknown;
};

const unavailable = (): PracticeRequestError =>
    new PracticeRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE);

// Iniciales de la delegación (primera letra de cada palabra) para el avatar de práctica.
const initialsOf = (delegation: string): string =>
    delegation
        .split(/\s+/)
        .map((word) => word.charAt(0))
        .join("");

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

const handleWalls = ({ state }: RouteInput): EventWallsResponse => {
    const { committeeId } = state.persona;
    return {
        event: { id: PRACTICE_EVENT_ID, name: "Práctica", slug: "practica" },
        membership: { id: PRACTICE_MEMBERSHIP_ID, role: "PARTICIPANT", committeeId },
        walls: buildPracticeWalls(committeeId),
    };
};

const handleCommittees = ({ state }: RouteInput): { committees: EventCommittee[] } => ({
    committees: practiceCommittees(state),
});

const handleProfile = ({ state }: RouteInput): { profile: MyProfile } => {
    const { persona } = state;
    const committee = PRACTICE_COMMITTEES.find((item) => item.id === persona.committeeId);
    return {
        profile: {
            membershipId: PRACTICE_MEMBERSHIP_ID,
            eventId: PRACTICE_EVENT_ID,
            role: "PARTICIPANT",
            delegationName: persona.delegation,
            delegationCode: persona.delegationCode,
            institutionName: null,
            committee: committee
                ? { id: committee.id, name: committee.name, code: committee.code }
                : null,
            profile: {
                id: null,
                firstName: persona.firstName,
                lastName: persona.lastName,
                displayName: persona.displayName,
                alias: null,
                bio: "",
                avatar: avatarFor(initialsOf(persona.delegation)),
            },
            accountStatus: "ACTIVE",
            participantCode: "PRACTICA",
            email: null,
        },
    };
};

const handlePosts = ({ query, state }: RouteInput): FeedResponse => {
    const muro = query.get("muro");
    if (!muro) {
        throw unavailable();
    }
    const wall = buildPracticeWalls(state.persona.committeeId).find((item) => item.slug === muro);
    if (!wall) {
        throw new PracticeRequestError(404, "Muro no encontrado");
    }
    if (!wall.canAccess) {
        throw new PracticeRequestError(403, "No tienes acceso a este muro");
    }
    return { wall, posts: [] };
};

const handleConversations = (): { conversations: ConversationSummary[] } => ({
    conversations: [],
});

const ROUTES: readonly Route[] = [
    { method: "GET", segments: ["events", PRACTICE_EVENT_ID, "walls"], handle: handleWalls },
    { method: "GET", segments: ["events", PRACTICE_EVENT_ID, "committees"], handle: handleCommittees },
    { method: "GET", segments: ["profiles", "me"], handle: handleProfile },
    { method: "GET", segments: ["posts"], handle: handlePosts },
    { method: "GET", segments: ["dm", "conversations"], handle: handleConversations },
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

const sameSegments = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((segment, index) => segment === right[index]);

// Enrutador síncrono y puro: atiende solo los caminos de la tabla y falla cerrado con 501 en el resto.
export const routePracticeRequest = (request: PracticeRequest, state: PracticeState): unknown => {
    const method = request.method.toUpperCase();
    const parsed = parsePath(request.path);
    if (parsed === null) {
        throw unavailable();
    }
    const route = ROUTES.find(
        (candidate) => candidate.method === method && sameSegments(candidate.segments, parsed.segments),
    );
    if (route === undefined) {
        throw unavailable();
    }
    return route.handle({ query: parsed.query, state });
};
