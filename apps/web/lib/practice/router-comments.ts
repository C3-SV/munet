import type { PostComment } from "../../types/common.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMIT_MESSAGES, PRACTICE_LIMITS } from "./limits.ts";
import type { PracticeComment } from "./model.ts";
import {
    bodyOf,
    nextId,
    PracticeRequestError,
    readableWallOrThrow,
    requireParam,
    textOf,
    visiblePostOrThrow,
    type PracticeRouteContext,
} from "./router-shared.ts";
import type { PracticeState } from "./state.ts";
import { toComment, toCommentDeleted } from "./views.ts";

// Escrituras de comentarios. Cada manejador valida todo antes de mutar el estado; los ids salen de
// state.seq y la fecha de context.now. Las respuestas admiten un solo nivel.

const ACCESS_MESSAGE = "No tienes acceso a los comentarios de este post";
const ANNOUNCEMENTS_MESSAGE = "No tienes permisos para comentar en avisos";
const CONTENT_MESSAGE = "El comentario no puede estar vacio";
const PARENT_MESSAGE = "Comentario padre no encontrado para este post";
const COMMENT_MESSAGE = "Comentario no encontrado en este post";
const DELETE_MESSAGE = "No tienes permisos para eliminar este comentario";

// Comentarios creados por la persona, también los borrados: el límite cuenta lo creado.
const ownCommentCount = (state: PracticeState): number =>
    state.comments.filter((comment) => comment.authorId === PRACTICE_MEMBERSHIP_ID).length;

// Padre del comentario: ausente, nulo o vacío significa primer nivel. Si viene, debe ser un comentario
// visible de esta misma publicación; si no, 404.
const parentOrThrow = (state: PracticeState, postId: string, raw: unknown): PracticeComment | null => {
    if (raw === undefined || raw === null) {
        return null;
    }
    if (typeof raw !== "string") {
        throw new PracticeRequestError(404, PARENT_MESSAGE);
    }
    const parentId = raw.trim();
    if (parentId === "") {
        return null;
    }
    const parent = state.comments.find(
        (comment) => comment.id === parentId && comment.postId === postId && !comment.deleted,
    );
    if (parent === undefined) {
        throw new PracticeRequestError(404, PARENT_MESSAGE);
    }
    return parent;
};

// POST /posts/:postId/comments: crea un comentario de primer nivel o una respuesta a un comentario de primer nivel.
export const handleCommentCreate = (context: PracticeRouteContext): { comment: PostComment } => {
    const { state, now } = context;
    const post = visiblePostOrThrow(state, requireParam(context.params, "postId"));
    const wall = readableWallOrThrow(state, post.wallSlug, ACCESS_MESSAGE);
    // En Avisos solo quien puede publicar comenta; en el resto, tener acceso al muro basta.
    if (wall.kind === "announcements" && !wall.canPublish) {
        throw new PracticeRequestError(403, ANNOUNCEMENTS_MESSAGE);
    }
    const input = bodyOf(context.body);
    const content = textOf(input.content).trim();
    if (content === "") {
        throw new PracticeRequestError(400, CONTENT_MESSAGE);
    }
    // Se puede responder a un comentario o a otra respuesta; la interfaz agrupa los hilos.
    const parent = parentOrThrow(state, post.id, input.parent_comment_id);
    if (ownCommentCount(state) >= PRACTICE_LIMITS.maxOwnComments) {
        throw new PracticeRequestError(400, PRACTICE_LIMIT_MESSAGES.ownComments);
    }

    // Todo validado: a partir de aquí solo se escribe.
    const comment: PracticeComment = {
        id: nextId(state, "comment"),
        postId: post.id,
        parentCommentId: parent?.id ?? null,
        authorId: PRACTICE_MEMBERSHIP_ID,
        content,
        createdAt: now.toISOString(),
        deleted: false,
    };
    state.comments.push(comment);
    context.wrote = true;
    return { comment: toComment(state, comment) };
};

// DELETE /posts/:postId/comments/:commentId: solo la autora borra. Sus respuestas siguen en el listado.
export const handleCommentDelete = (context: PracticeRouteContext): { comment: PostComment } => {
    const { state } = context;
    const post = visiblePostOrThrow(state, requireParam(context.params, "postId"));
    readableWallOrThrow(state, post.wallSlug, ACCESS_MESSAGE);
    const commentId = requireParam(context.params, "commentId");
    const comment = state.comments.find(
        (item) => item.id === commentId && item.postId === post.id && !item.deleted,
    );
    if (comment === undefined) {
        throw new PracticeRequestError(404, COMMENT_MESSAGE);
    }
    if (comment.authorId !== PRACTICE_MEMBERSHIP_ID) {
        throw new PracticeRequestError(403, DELETE_MESSAGE);
    }
    comment.deleted = true;
    context.wrote = true;
    return { comment: toCommentDeleted(state, comment) };
};
