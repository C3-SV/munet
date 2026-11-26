import { requestApi } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ModerationStatus = "VISIBLE" | "HIDDEN" | "DELETED";
export type ModerationStatusFilter = "VISIBLE" | "HIDDEN" | "DELETED" | "ALL";

export type ModerationWall = {
    id: string;
    event_id: string;
    committee_id: string | null;
    wall_type: "GENERAL" | "COMMITTEE" | "ANNOUNCEMENTS";
    name: string;
    status: "ACTIVE";
    visible_posts: number;
    pinned_posts: number;
};

export type ModerationPostState = {
    id: string;
    event_id: string;
    wall_id: string;
    author_membership_id: string;
    status: ModerationStatus;
    deleted_at: string | null;
    deleted_by_membership_uuid: string | null;
    // Tipo de actor, no un id.
    deleted_by_membership_id: "AUTHOR" | "ADMIN" | null;
    is_pinned: boolean;
    pinned_at: string | null;
    pinned_by_membership_id: string | null;
};

export type ModerationCommentState = {
    id: string;
    event_id: string;
    post_id: string;
    author_membership_id: string;
    status: ModerationStatus;
    deleted_at: string | null;
    deleted_by_membership_uuid: string | null;
    deleted_by_actor_type: "AUTHOR" | "ADMIN" | null;
};

export type ModerationDetail = {
    content: string;
    created_at: string;
    updated_at: string;
    author: {
        membership_id: string;
        name: string | null;
        alias: string | null;
        participant_code: string | null;
        delegation_code: string | null;
        committee: { id: string; name: string; code: string | null } | null;
    };
    deleted_by_name: string | null;
    deletion_reason: string | null;
};

// Adjunto del post, sin URL. Moderación lo ve aunque el post esté eliminado, hasta la purga.
export type ModerationAttachment = {
    id: string;
    name: string;
    mimeType: string;
    size: number;
};

export type ModerationPost = ModerationPostState &
    ModerationDetail & {
        post_type: "TEXT" | "LINK" | "POLL";
        title: string | null;
        attachment: ModerationAttachment | null;
    };

export type ModerationComment = ModerationCommentState &
    ModerationDetail & { parent_comment_id: string | null };

export type ModerationPagination = {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
};

export type ListModerationPostsParams = {
    status?: ModerationStatusFilter;
    page?: number;
    limit?: number;
    // Filtra por persona (membership del evento) dentro del muro; omitido = todas.
    author_membership_id?: string;
};

// El máximo de fijados por muro lo valida la API; se usa solo para deshabilitar el botón.
export const MAX_PINNED_POSTS = 3;

// ─── Lectura ──────────────────────────────────────────────────────────────────

export const listModerationWalls = async (
    token: string,
    eventId: string,
): Promise<ModerationWall[]> => {
    const payload = await requestApi<{ walls: ModerationWall[] }>(
        `/admin/moderation/walls?event_id=${encodeURIComponent(eventId)}`,
        { token },
    );

    return payload.walls;
};

// Solo lectura para moderadores: sin contacto y ordenada por apellido y nombre en la API.
export type ModerationPerson = {
    id: string;
    participant_code: string;
    first_name: string;
    last_name: string;
    alias: string | null;
};

export const listModerationPeople = async (
    token: string,
    eventId: string,
): Promise<ModerationPerson[]> => {
    const payload = await requestApi<{ people: ModerationPerson[] }>(
        `/admin/moderation/people?event_id=${encodeURIComponent(eventId)}`,
        { token },
    );

    return payload.people;
};

export const listModerationPosts = (
    token: string,
    wallId: string,
    { status = "VISIBLE", page = 1, limit = 20, author_membership_id }: ListModerationPostsParams = {},
) => {
    const params = new URLSearchParams({
        wall_id: wallId,
        status,
        page: String(page),
        limit: String(limit),
    });

    if (author_membership_id) {
        params.set("author_membership_id", author_membership_id);
    }

    return requestApi<{
        posts: ModerationPost[];
        pagination: ModerationPagination;
    }>(`/admin/moderation/posts?${params.toString()}`, { token });
};

export const listModerationComments = async (
    token: string,
    postId: string,
    { status }: { status?: ModerationStatusFilter } = {},
): Promise<ModerationComment[]> => {
    const query = status ? `?status=${status}` : "";
    const payload = await requestApi<{ comments: ModerationComment[] }>(
        `/admin/moderation/posts/${postId}/comments${query}`,
        { token },
    );

    return payload.comments;
};

// ─── Acciones ─────────────────────────────────────────────────────────────────
// Las respuestas traen solo el estado, sin autor ni contenido.

export const deleteModerationPost = async (
    token: string,
    postId: string,
    reason: string,
): Promise<ModerationPostState> => {
    const payload = await requestApi<{ post: ModerationPostState }>(
        `/admin/moderation/posts/${postId}/delete`,
        { method: "POST", token, body: { reason } },
    );

    return payload.post;
};

export const deleteModerationComment = async (
    token: string,
    commentId: string,
    reason: string,
): Promise<ModerationCommentState> => {
    const payload = await requestApi<{ comment: ModerationCommentState }>(
        `/admin/moderation/comments/${commentId}/delete`,
        { method: "POST", token, body: { reason } },
    );

    return payload.comment;
};

// Ocultar y restaurar: el contenido no se borra. Exigen motivo; 409 si el estado no corresponde.
export const hideModerationPost = async (
    token: string,
    postId: string,
    reason: string,
): Promise<ModerationPostState> => {
    const payload = await requestApi<{ post: ModerationPostState }>(
        `/admin/moderation/posts/${postId}/hide`,
        { method: "POST", token, body: { reason } },
    );

    return payload.post;
};

export const unhideModerationPost = async (
    token: string,
    postId: string,
    reason: string,
): Promise<ModerationPostState> => {
    const payload = await requestApi<{ post: ModerationPostState }>(
        `/admin/moderation/posts/${postId}/unhide`,
        { method: "POST", token, body: { reason } },
    );

    return payload.post;
};

export const hideModerationComment = async (
    token: string,
    commentId: string,
    reason: string,
): Promise<ModerationCommentState> => {
    const payload = await requestApi<{ comment: ModerationCommentState }>(
        `/admin/moderation/comments/${commentId}/hide`,
        { method: "POST", token, body: { reason } },
    );

    return payload.comment;
};

export const unhideModerationComment = async (
    token: string,
    commentId: string,
    reason: string,
): Promise<ModerationCommentState> => {
    const payload = await requestApi<{ comment: ModerationCommentState }>(
        `/admin/moderation/comments/${commentId}/unhide`,
        { method: "POST", token, body: { reason } },
    );

    return payload.comment;
};

// Retira el adjunto sin borrar el post. Exige motivo (3 a 500 caracteres) y queda auditado.
export const removeModerationAttachment = async (
    token: string,
    postId: string,
    reason: string,
): Promise<void> => {
    await requestApi<{ removed: boolean }>(
        `/admin/moderation/posts/${postId}/attachment/delete`,
        { method: "POST", token, body: { reason } },
    );
};

export const pinPost = async (
    token: string,
    postId: string,
): Promise<ModerationPostState> => {
    const payload = await requestApi<{ post: ModerationPostState }>(
        `/admin/moderation/posts/${postId}/pin`,
        { method: "POST", token },
    );

    return payload.post;
};

export const unpinPost = async (
    token: string,
    postId: string,
): Promise<ModerationPostState> => {
    const payload = await requestApi<{ post: ModerationPostState }>(
        `/admin/moderation/posts/${postId}/unpin`,
        { method: "POST", token },
    );

    return payload.post;
};
