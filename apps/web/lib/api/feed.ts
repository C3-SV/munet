import type { Post } from "../../types/common";
import { requestApi } from "./client";

export type FeedResponse = {
    wall: {
        id: string;
        eventId: string;
        name: string;
        wallType: string;
        kind: "general" | "announcements" | "committee" | "other";
        slug: string;
        committeeId: string | null;
        committeeName: string | null;
        committeeCode: string | null;
        canAccess: boolean;
        canPublish: boolean;
    };
    posts: Post[];
};

type FeedRequestContext = {
    token: string;
    eventId: string;
};

type CreatePostInput = FeedRequestContext & {
    muro: string;
    content: string;
};

export const getFeedPosts = async (
    muro: string,
    context: FeedRequestContext,
): Promise<FeedResponse> =>
    requestApi<FeedResponse>(`/posts?muro=${encodeURIComponent(muro)}`, {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    });

export const publishFeedPost = async ({
    muro,
    content,
    token,
    eventId,
}: CreatePostInput): Promise<Post> => {
    const payload = await requestApi<{ post: Post }>("/posts", {
        method: "POST",
        token,
        eventId,
        body: {
            muro,
            content,
        },
    });

    return payload.post;
};
