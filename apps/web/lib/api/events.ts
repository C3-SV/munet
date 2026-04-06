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

export const getEventWalls = async (
    context: EventContext,
): Promise<EventWallsResponse> =>
    requestApi<EventWallsResponse>(`/events/${context.eventId}/walls`, {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    });
