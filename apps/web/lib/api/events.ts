import type { EventSummary, EventWall } from "../../types/common";
import { requestApi } from "./client";

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
): Promise<EventWallsResponse> =>
    requestApi<EventWallsResponse>(`/events/${context.eventId}/walls`, {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    });

export const getEventCommittees = async (
    context: EventContext,
): Promise<EventCommittee[]> => {
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
};
