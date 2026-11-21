import {
    publishWithAttachment,
    putFileToStorage,
    type UploadTicket,
} from "../attachment-upload";
import type { Post } from "../../types/common";
import { ApiError, requestApi } from "./client";

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
    // Cero o un archivo (JPG/PNG/PDF). Se sube directo al almacenamiento antes de crear el post.
    attachment?: File;
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
    attachment,
    token,
    eventId,
}: CreatePostInput): Promise<Post> => {
    // Publica texto o encuesta segun `post_type`, con adjunto opcional.
    const createPost = async (uploadId?: string) => {
        const payload = await requestApi<{ post: Post }>("/posts", {
            method: "POST",
            token,
            eventId,
            body: {
                muro,
                content,
                post_type: postType ?? "TEXT",
                poll_options: pollOptions,
                ...(uploadId ? { upload_id: uploadId } : {}),
            },
        });

        return payload.post;
    };

    if (!attachment) {
        return createPost();
    }

    return publishWithAttachment({
        initUpload: async () => {
            const payload = await requestApi<{ upload: UploadTicket }>("/posts/attachments/init", {
                method: "POST",
                token,
                eventId,
                body: {
                    muro,
                    file_name: attachment.name,
                    mime_type: attachment.type,
                    size: attachment.size,
                },
            });

            return payload.upload;
        },
        upload: (ticket) =>
            putFileToStorage(ticket, attachment, (url, init) =>
                fetch(url, { ...init, body: init.body as BodyInit }),
            ),
        createPost,
        // Solo los cortes de red: la API es idempotente por `upload_id` y devuelve el mismo post.
        isRetryable: (error) => !(error instanceof ApiError),
    });
};

// Pide a la API una URL de descarga de 60 segundos. Se llama al abrir el adjunto, no al listar.
export const getAttachmentDownloadUrl = async (
    postId: string,
    context: FeedRequestContext,
): Promise<string> => {
    const payload = await requestApi<{ url: string }>(`/posts/${postId}/attachment/download`, {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    });

    return payload.url;
};

// El autor retira el adjunto de su publicación.
export const removeOwnAttachment = async (
    postId: string,
    context: FeedRequestContext,
): Promise<void> => {
    await requestApi<{ removed: boolean }>(`/posts/${postId}/attachment`, {
        method: "DELETE",
        token: context.token,
        eventId: context.eventId,
    });
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
