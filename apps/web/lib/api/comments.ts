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
