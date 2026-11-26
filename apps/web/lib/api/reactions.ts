import { requestApi } from "./client";
import type { PostReactions, ReactionType } from "../reactions";

type ReactionContext = {
    token: string;
    eventId: string;
};

// Agrega o cambia la reacción de la persona; devuelve el resumen actualizado de la publicación.
export const reactToPost = async (
    postId: string,
    reaction: ReactionType,
    context: ReactionContext,
): Promise<PostReactions> => {
    const payload = await requestApi<{ reactions: PostReactions }>(`/posts/${postId}/reaction`, {
        method: "PUT",
        token: context.token,
        eventId: context.eventId,
        body: { reaction },
    });

    return payload.reactions;
};

// Retira la reacción de la persona.
export const unreactToPost = async (postId: string, context: ReactionContext): Promise<PostReactions> => {
    const payload = await requestApi<{ reactions: PostReactions }>(`/posts/${postId}/reaction`, {
        method: "DELETE",
        token: context.token,
        eventId: context.eventId,
    });

    return payload.reactions;
};

// Reacciones de varias publicaciones (para refrescar contadores cuando llega un cambio).
export const getPostReactions = async (
    postIds: string[],
    context: ReactionContext,
): Promise<Record<string, PostReactions>> => {
    const payload = await requestApi<{ reactions: Record<string, PostReactions> }>(
        `/posts/reactions?ids=${encodeURIComponent(postIds.join(","))}`,
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );

    return payload.reactions;
};
