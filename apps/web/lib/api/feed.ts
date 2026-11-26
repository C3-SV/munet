import {
    AttachmentUploadError,
    publishWithAttachments,
    putFileToStorage,
    type UploadProgress,
    type UploadTicket,
} from "../attachment-upload";
import { putFileWithProgress } from "../attachment-xhr";
import type { Post } from "../../types/common";
import { isPracticeEvent } from "../practice/constants";
import { stashPracticeFile } from "../practice/uploads";
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
    // Cero a doce archivos (hasta 10 imágenes JPG/PNG y 2 PDF). Cada uno se sube directo al
    // almacenamiento antes de crear el post.
    attachments?: File[];
    // Avance de la subida, por archivo y total.
    onUploadProgress?: (progress: UploadProgress) => void;
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
    attachments,
    onUploadProgress,
    token,
    eventId,
}: CreatePostInput): Promise<Post> => {
    // Publica texto o encuesta segun `post_type`, con adjuntos opcionales.
    const createPost = async (uploadIds: string[] = []) => {
        const payload = await requestApi<{ post: Post }>("/posts", {
            method: "POST",
            token,
            eventId,
            body: {
                muro,
                content,
                post_type: postType ?? "TEXT",
                poll_options: pollOptions,
                ...(uploadIds.length > 0
                    ? // upload_id (el primero) lo usan el modo práctica y clientes anteriores.
                      { upload_ids: uploadIds, upload_id: uploadIds[0] }
                    : {}),
            },
        });

        return payload.post;
    };

    const files = attachments ?? [];

    if (files.length === 0) {
        return createPost();
    }

    // La práctica guarda los archivos en el navegador y admite uno por publicación.
    if (isPracticeEvent(eventId) && files.length > 1) {
        throw new AttachmentUploadError("En la práctica solo puedes adjuntar un archivo por publicación.");
    }

    return publishWithAttachments({
        files,
        initUpload: async (file) => {
            const payload = await requestApi<{ upload: UploadTicket }>("/posts/attachments/init", {
                method: "POST",
                token,
                eventId,
                body: {
                    muro,
                    file_name: file.name,
                    mime_type: file.type,
                    size: file.size,
                },
            });

            return payload.upload;
        },
        upload: async (ticket, file, onProgress) => {
            // En práctica no hay almacenamiento real: el archivo se guarda en el navegador al crear la publicación.
            if (isPracticeEvent(eventId)) {
                stashPracticeFile(ticket.id, file);
                onProgress(file.size);
                return;
            }

            // Con progreso real; si el navegador no tuviera XMLHttpRequest se usa fetch sin avance.
            if (typeof XMLHttpRequest !== "undefined") {
                return putFileWithProgress(ticket, file, onProgress);
            }

            await putFileToStorage(ticket, file, (url, init) =>
                fetch(url, { ...init, body: init.body as BodyInit }),
            );
            onProgress(file.size);
        },
        createPost,
        onProgress: onUploadProgress,
        // Solo los cortes de red: la API es idempotente por `upload_id` y devuelve el mismo post.
        isRetryable: (error) => !(error instanceof ApiError),
    });
};

// Pide a la API una URL de descarga de 60 segundos. Se llama al abrir el adjunto, no al listar.
export const getAttachmentDownloadUrl = async (
    postId: string,
    context: FeedRequestContext,
    // Sin id se pide el primer adjunto (publicaciones de un solo archivo).
    attachmentId?: string,
): Promise<string> => {
    // La práctica admite un adjunto por publicación y solo conoce la ruta sin id.
    const path =
        attachmentId && !isPracticeEvent(context.eventId)
            ? `/posts/${postId}/attachments/${attachmentId}/download`
            : `/posts/${postId}/attachment/download`;
    const payload = await requestApi<{ url: string }>(path, {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    });

    return payload.url;
};

// El autor retira un adjunto de su publicación.
export const removeOwnAttachment = async (
    postId: string,
    context: FeedRequestContext,
    attachmentId?: string,
): Promise<void> => {
    const path =
        attachmentId && !isPracticeEvent(context.eventId)
            ? `/posts/${postId}/attachments/${attachmentId}`
            : `/posts/${postId}/attachment`;
    await requestApi<{ removed: boolean }>(path, {
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
