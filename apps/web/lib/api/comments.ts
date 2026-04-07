import type { PostComment } from "../../types/common";
import { requestApi } from "./client";

type CommentContext = {
    token: string;
    eventId: string;
};

export const getPostComments = async (
    postId: string,
    context: CommentContext,
): Promise<PostComment[]> => {
    // Lista comentarios de un post en el evento activo.
    const payload = await requestApi<{ comments: PostComment[] }>(
        `/posts/${postId}/comments`,
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );

    return payload.comments;
};

export const createPostComment = async (
    postId: string,
    context: CommentContext & { content: string; parentCommentId?: string | null },
): Promise<PostComment> => {
    // Crea comentario o respuesta simple (1 nivel) segun parent_comment_id.
    const payload = await requestApi<{ comment: PostComment }>(
        `/posts/${postId}/comments`,
        {
            method: "POST",
            token: context.token,
            eventId: context.eventId,
            body: {
                content: context.content,
                ...(context.parentCommentId
                    ? { parent_comment_id: context.parentCommentId }
                    : {}),
            },
        },
    );

    return payload.comment;
};

export const deletePostComment = async (
    postId: string,
    commentId: string,
    context: CommentContext,
): Promise<PostComment> => {
    // Soft delete de comentario con reglas autor/admin en backend.
    const payload = await requestApi<{ comment: PostComment }>(
        `/posts/${postId}/comments/${commentId}`,
        {
            method: "DELETE",
            token: context.token,
            eventId: context.eventId,
        },
    );

    return payload.comment;
};
