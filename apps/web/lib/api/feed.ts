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
    postType?: "TEXT" | "POLL";
    pollOptions?: string[];
};

export const getFeedPosts = async (
    muro: string,
    context: FeedRequestContext,
): Promise<FeedResponse> =>
    // Carga feed de un muro con control RBAC aplicado por backend.
    requestApi<FeedResponse>(`/posts?muro=${encodeURIComponent(muro)}`, {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    });

export const publishFeedPost = async ({
    muro,
    content,
    postType,
    pollOptions,
    token,
    eventId,
}: CreatePostInput): Promise<Post> => {
    // Publica texto o encuesta segun `post_type`.
    const payload = await requestApi<{ post: Post }>("/posts", {
        method: "POST",
        token,
        eventId,
        body: {
            muro,
            content,
            post_type: postType ?? "TEXT",
            poll_options: pollOptions,
        },
    });

    return payload.post;
};

export const deleteFeedPost = async (
    postId: string,
    context: FeedRequestContext,
): Promise<Post> => {
    // Soft delete del post; backend devuelve entidad actualizada.
    const payload = await requestApi<{ post: Post }>(`/posts/${postId}`, {
        method: "DELETE",
        token: context.token,
        eventId: context.eventId,
    });

    return payload.post;
};

export const voteOnFeedPoll = async (
    postId: string,
    optionId: string,
    context: FeedRequestContext,
): Promise<Post> => {
    // Registra/actualiza voto de encuesta y retorna post enriquecido.
    const payload = await requestApi<{ post: Post }>(`/posts/${postId}/poll/vote`, {
        method: "POST",
        token: context.token,
        eventId: context.eventId,
        body: {
            option_id: optionId,
        },
    });

    return payload.post;
};

export const closeFeedPoll = async (
    postId: string,
    context: FeedRequestContext,
): Promise<Post> => {
    // Cierra encuesta (accion permitida solo al autor en backend).
    const payload = await requestApi<{ post: Post }>(`/posts/${postId}/poll/close`, {
        method: "POST",
        token: context.token,
        eventId: context.eventId,
    });

    return payload.post;
};
