import type { EventSummary, EventWall } from "../../types/common";
import { useAuthStore } from "../../stores/auth.store";
import { isPracticeEvent } from "../practice/constants";
import { requestApi } from "./client";

const EVENT_CATALOG_TTL_MS = 30_000;
const catalogCache = new Map<string, { value: unknown; expiresAt: number }>();
const catalogRequests = new Map<string, Promise<unknown>>();
const catalogEventVersions = new Map<string, number>();
const catalogContext = (state: ReturnType<typeof useAuthStore.getState>) => JSON.stringify([
    state.token,
    state.activeEventId,
    state.activeMembershipId,
    state.practice,
    state.memberships.find((membership) => membership.id === state.activeMembershipId),
]);
let activeCatalogContext = catalogContext(useAuthStore.getState());
let catalogContextVersion = 0;

useAuthStore.subscribe((state) => {
    const nextContext = catalogContext(state);
    if (nextContext !== activeCatalogContext) {
        activeCatalogContext = nextContext;
        catalogContextVersion++;
        catalogCache.clear();
        catalogRequests.clear();
        catalogEventVersions.clear();
    }
});

export const invalidateEventCatalogs = (token: string, eventId: string) => {
    if (isPracticeEvent(eventId)) return;

    const eventKey = JSON.stringify([token, eventId]);
    catalogEventVersions.set(eventKey, (catalogEventVersions.get(eventKey) ?? 0) + 1);
    for (const catalogs of [catalogCache, catalogRequests]) {
        for (const key of catalogs.keys()) {
            const [, cachedToken, cachedEventId] = JSON.parse(key) as [string, string, string];
            if (cachedToken === token && cachedEventId === eventId) catalogs.delete(key);
        }
    }
};

const cachedCatalog = <T>(kind: string, context: EventContext, load: () => Promise<T>): Promise<T> => {
    if (isPracticeEvent(context.eventId)) return load();

    const key = JSON.stringify([kind, context.token, context.eventId]);
    const now = Date.now();
    for (const [cacheKey, entry] of catalogCache) {
        if (entry.expiresAt <= now) catalogCache.delete(cacheKey);
    }

    const cached = catalogCache.get(key);
    if (cached) return Promise.resolve(cached.value as T);
    const pending = catalogRequests.get(key);
    if (pending) return pending as Promise<T>;

    const contextVersion = catalogContextVersion;
    const eventKey = JSON.stringify([context.token, context.eventId]);
    const eventVersion = catalogEventVersions.get(eventKey) ?? 0;
    const request = load().then((value) => {
        const state = useAuthStore.getState();
        if (
            contextVersion === catalogContextVersion &&
            eventVersion === (catalogEventVersions.get(eventKey) ?? 0) &&
            state.token === context.token &&
            state.activeEventId === context.eventId &&
            !state.practice
        ) {
            catalogCache.set(key, { value, expiresAt: Date.now() + EVENT_CATALOG_TTL_MS });
        }
        return value;
    }).finally(() => {
        if (catalogRequests.get(key) === request) catalogRequests.delete(key);
    });

    catalogRequests.set(key, request);
    return request;
};

type EventContext = {
    token: string;
    eventId: string;
};

export type EventWallsResponse = {
    event: EventSummary;
    membership: {
        id: string;
        role: string;
        committeeId: string | null;
    };
    walls: EventWall[];
};

export type EventCommittee = {
    id: string;
    event_id: string;
    name: string;
    code: string;
    description: string | null;
    status: string;
    sort_order: number;
    canAccess: boolean;
};

export const getEventWalls = async (
    context: EventContext,
): Promise<EventWallsResponse> => cachedCatalog("walls", context, () =>
    // Devuelve todos los muros del evento con bandera `canAccess` por usuario.
    requestApi<EventWallsResponse>(`/events/${context.eventId}/walls`, {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    }));

export const getEventCommittees = async (
    context: EventContext,
): Promise<EventCommittee[]> => cachedCatalog("committees", context, async () => {
    // Lista comites activos del evento para sidebar/filtros/formularios.
    const payload = await requestApi<{ committees: EventCommittee[] }>(
        `/events/${context.eventId}/committees`,
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );

    return payload.committees;
});
