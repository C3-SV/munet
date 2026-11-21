import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMIT_MESSAGES, PRACTICE_LIMITS } from "./limits.ts";
import { PracticeRequestError, routePracticeRequest, routePracticeRequestDetailed } from "./router.ts";
import { createInitialState } from "./state.ts";

const NOW = new Date("2026-11-21T12:00:00Z");
const NO_ACCESS = "No tienes acceso a los comentarios de este post";
const NO_POST = "Post no encontrado en este evento";
const AVISOS_FORBIDDEN = "No tienes permisos para comentar en avisos";
const EMPTY = "El comentario no puede estar vacio";
const PARENT_MISSING = "Comentario padre no encontrado para este post";
const ONE_LEVEL = "Solo se permite un nivel de respuesta";
const COMMENT_MISSING = "Comentario no encontrado en este post";
const DELETE_FORBIDDEN = "No tienes permisos para eliminar este comentario";
const DELETED_OWN_TEXT = "Este comentario fue eliminado por el autor.";

// Datos sembrados: el estado inicial es determinista para "u1" y NOW.
const BASE = createInitialState("u1", NOW);
const slugOf = (committee) => `comite-${committee.code.toLowerCase()}`;
const FOREIGN_SLUG = slugOf(PRACTICE_COMMITTEES.find((committee) => committee.id !== BASE.persona.committeeId));
const visiblePostIn = (slug) => BASE.posts.find((post) => post.wallSlug === slug && !post.deleted);
const avisosPost = visiblePostIn("avisos");
const foreignPost = visiblePostIn(FOREIGN_SLUG);
// Comentario de primer nivel de General con una respuesta sembrada.
const parentComment = BASE.comments.find(
    (comment) => comment.parentCommentId === null && BASE.comments.some((reply) => reply.parentCommentId === comment.id),
);
const seededReply = BASE.comments.find((comment) => comment.parentCommentId === parentComment.id);
const commentedPost = BASE.posts.find((post) => post.id === parentComment.postId);
const otherGeneralPost = BASE.posts.find(
    (post) => post.wallSlug === "general" && post.id !== commentedPost.id && !post.deleted,
);

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let state;

beforeEach(() => {
    // Ninguna escritura de la práctica puede llegar a la red.
    fetchCalls = 0;
    globalThis.fetch = () => {
        fetchCalls += 1;
        throw new Error("fetch prohibido");
    };
    state = createInitialState("u1", NOW);
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const call = (method, path, body) => routePracticeRequest({ method, path, body }, state, { now: NOW });
const outcome = (method, path, body) => routePracticeRequestDetailed({ method, path, body }, state, { now: NOW });
const isRequestError = (status, message) => (error) =>
    error instanceof PracticeRequestError && error.status === status && error.message === message;
const assertFails = (fn, status, message) => assert.throws(fn, isRequestError(status, message));
// Un intento fallido no cambia el estado: ni comentarios, ni id siguiente, ni nada más.
const unchangedAfter = (fn) => {
    const before = JSON.stringify(state);
    assert.throws(fn, PracticeRequestError);
    assert.equal(JSON.stringify(state), before);
};

const commentOn = (postId, body) => call("POST", `/posts/${postId}/comments`, body).comment;
const ownComment = (postId, content, parentCommentId) =>
    commentOn(postId, parentCommentId === undefined ? { content } : { content, parent_comment_id: parentCommentId });
const listedComments = (postId) => call("GET", `/posts/${postId}/comments`).comments;
const wallPost = (slug, postId) => call("GET", `/posts?muro=${slug}`).posts.find((post) => post.id === postId);
const ownCommentsCount = () => state.comments.filter((comment) => comment.authorId === PRACTICE_MEMBERSHIP_ID).length;

test("datos de partida de las pruebas: hay respuesta sembrada y publicaciones en cada muro", () => {
    assert.ok(parentComment);
    assert.ok(seededReply);
    assert.equal(commentedPost.wallSlug, "general");
    assert.equal(avisosPost.wallSlug, "avisos");
    assert.equal(foreignPost.wallSlug, FOREIGN_SLUG);
    assert.ok(otherGeneralPost);
});

test("comentar crea el comentario con id, fecha y autora del estado, y devuelve 201 con el comentario", () => {
    const seqBefore = state.seq;
    const result = outcome("POST", `/posts/${commentedPost.id}/comments`, { content: "  Estoy de acuerdo  " });
    const { comment } = result.result;
    assert.equal(comment.id, `practice-comment-${seqBefore}`);
    assert.equal(state.seq, seqBefore + 1);
    assert.equal(comment.postId, commentedPost.id);
    assert.equal(comment.parentCommentId, null);
    assert.equal(comment.content, "Estoy de acuerdo");
    assert.equal(comment.user.id, PRACTICE_MEMBERSHIP_ID);
    assert.equal(comment.canDelete, true);
    assert.equal(comment.isDeleted, false);
    assert.equal(comment.createdAt, NOW.toISOString());
    assert.equal(comment.timestamp, NOW.getTime());
    assert.equal(result.wrote, true);
    assert.equal(fetchCalls, 0);
});

test("comentar suma uno al contador del muro y el comentario aparece al final del listado", () => {
    const before = wallPost("general", commentedPost.id).commentCount;
    const comment = ownComment(commentedPost.id, "Nuevo comentario");
    assert.equal(wallPost("general", commentedPost.id).commentCount, before + 1);
    const listed = listedComments(commentedPost.id);
    assert.equal(listed.at(-1).id, comment.id);
});

test("responder a un comentario de primer nivel sembrado funciona y responder a esa respuesta da 400", () => {
    const reply = ownComment(commentedPost.id, "Respuesta propia", parentComment.id);
    assert.equal(reply.parentCommentId, parentComment.id);
    assertFails(
        () => ownComment(commentedPost.id, "Respuesta a la respuesta", reply.id),
        400,
        ONE_LEVEL,
    );
});

test("responder a una respuesta sembrada da 400 sin escribir", () => {
    assertFails(() => ownComment(commentedPost.id, "Nivel tres", seededReply.id), 400, ONE_LEVEL);
    unchangedAfter(() => ownComment(commentedPost.id, "Nivel tres", seededReply.id));
});

test("comentar en una publicación borrada da 404 Post no encontrado", () => {
    const post = call("POST", "/posts", { muro: "general", content: "Se borra", post_type: "TEXT" }).post;
    call("DELETE", `/posts/${post.id}`);
    unchangedAfter(() => ownComment(post.id, "Hola"));
    assertFails(() => ownComment(post.id, "Hola"), 404, NO_POST);
});

test("comentar en un post inexistente da 404 Post no encontrado en este evento", () => {
    assertFails(() => ownComment("practice-post-999", "Hola"), 404, NO_POST);
});

test("comentar en avisos da 403 de permisos para comentar en avisos", () => {
    assertFails(() => ownComment(avisosPost.id, "Hola"), 403, AVISOS_FORBIDDEN);
    assert.equal(ownCommentsCount(), 0);
});

test("comentar en avisos sin contenido sigue dando el 403 de avisos (orden de las reglas)", () => {
    assertFails(() => commentOn(avisosPost.id, { content: "   " }), 403, AVISOS_FORBIDDEN);
});

test("comentar en un muro ajeno da 403 de acceso", () => {
    assertFails(() => ownComment(foreignPost.id, "Hola"), 403, NO_ACCESS);
    unchangedAfter(() => ownComment(foreignPost.id, "Hola"));
});

test("contenido vacío o solo espacios da 400 y no escribe", () => {
    assertFails(() => commentOn(commentedPost.id, { content: "   " }), 400, EMPTY);
    assertFails(() => commentOn(commentedPost.id, { content: "" }), 400, EMPTY);
    assertFails(() => commentOn(commentedPost.id, {}), 400, EMPTY);
    unchangedAfter(() => commentOn(commentedPost.id, { content: "   " }));
});

test("padre inexistente da 404 Comentario padre no encontrado para este post", () => {
    unchangedAfter(() => ownComment(commentedPost.id, "Hola", "practice-comment-999"));
    assertFails(() => ownComment(commentedPost.id, "Hola", "practice-comment-999"), 404, PARENT_MISSING);
});

test("padre de otra publicación da 404 Comentario padre no encontrado para este post", () => {
    assertFails(() => ownComment(otherGeneralPost.id, "Hola", parentComment.id), 404, PARENT_MISSING);
});

test("padre borrado da 404 Comentario padre no encontrado para este post", () => {
    const own = ownComment(commentedPost.id, "Mío y borrable");
    call("DELETE", `/posts/${commentedPost.id}/comments/${own.id}`);
    assertFails(() => ownComment(commentedPost.id, "Hola", own.id), 404, PARENT_MISSING);
});

test("el límite de comentarios propios cuenta también los borrados y da 400 sin escribir", () => {
    for (let index = 0; index < PRACTICE_LIMITS.maxOwnComments; index += 1) {
        ownComment(commentedPost.id, `Comentario ${index + 1}`);
    }
    assert.equal(ownCommentsCount(), PRACTICE_LIMITS.maxOwnComments);
    const first = state.comments.find((comment) => comment.authorId === PRACTICE_MEMBERSHIP_ID);
    call("DELETE", `/posts/${commentedPost.id}/comments/${first.id}`);
    assertFails(
        () => ownComment(commentedPost.id, "Uno más"),
        400,
        PRACTICE_LIMIT_MESSAGES.ownComments,
    );
    assert.equal(ownCommentsCount(), PRACTICE_LIMITS.maxOwnComments);
});

test("borrar el comentario propio lo quita del listado, deja a sus hijos y devuelve el marcador de borrado", () => {
    const parent = ownComment(commentedPost.id, "Padre propio");
    const child = ownComment(commentedPost.id, "Hijo propio", parent.id);
    const result = outcome("DELETE", `/posts/${commentedPost.id}/comments/${parent.id}`);
    const { comment } = result.result;
    assert.equal(comment.isDeleted, true);
    assert.equal(comment.deletedByActorType, "AUTHOR");
    assert.equal(comment.content, DELETED_OWN_TEXT);
    assert.equal(comment.canDelete, false);
    assert.equal(result.wrote, true);

    const listed = listedComments(commentedPost.id);
    assert.equal(listed.some((item) => item.id === parent.id), false);
    const survivor = listed.find((item) => item.id === child.id);
    assert.ok(survivor);
    assert.equal(survivor.parentCommentId, parent.id);
});

test("el comentario borrado deja de contar en el contador del muro", () => {
    const own = ownComment(commentedPost.id, "Efímero");
    const before = wallPost("general", commentedPost.id).commentCount;
    call("DELETE", `/posts/${commentedPost.id}/comments/${own.id}`);
    assert.equal(wallPost("general", commentedPost.id).commentCount, before - 1);
});

test("borrar el comentario de otra persona da 403 y no cambia nada", () => {
    unchangedAfter(() => call("DELETE", `/posts/${commentedPost.id}/comments/${parentComment.id}`));
    assertFails(
        () => call("DELETE", `/posts/${commentedPost.id}/comments/${parentComment.id}`),
        403,
        DELETE_FORBIDDEN,
    );
});

test("borrar un comentario que no existe, ya está borrado o es de otro post da 404", () => {
    assertFails(
        () => call("DELETE", `/posts/${commentedPost.id}/comments/practice-comment-999`),
        404,
        COMMENT_MISSING,
    );
    assertFails(
        () => call("DELETE", `/posts/${otherGeneralPost.id}/comments/${parentComment.id}`),
        404,
        COMMENT_MISSING,
    );
    const own = ownComment(commentedPost.id, "Una vez");
    call("DELETE", `/posts/${commentedPost.id}/comments/${own.id}`);
    assertFails(
        () => call("DELETE", `/posts/${commentedPost.id}/comments/${own.id}`),
        404,
        COMMENT_MISSING,
    );
});

test("borrar en un muro ajeno da 403 de acceso y en una publicación borrada da 404", () => {
    assertFails(
        () => call("DELETE", `/posts/${foreignPost.id}/comments/practice-comment-999`),
        403,
        NO_ACCESS,
    );
    const post = call("POST", "/posts", { muro: "general", content: "Borrada", post_type: "TEXT" }).post;
    call("DELETE", `/posts/${post.id}`);
    assertFails(
        () => call("DELETE", `/posts/${post.id}/comments/practice-comment-999`),
        404,
        NO_POST,
    );
});

test("los comentarios escriben solo con un identificador y una fecha del estado, sin red", () => {
    ownComment(commentedPost.id, "Sin red");
    call("DELETE", `/posts/${commentedPost.id}/comments/${state.comments.at(-1).id}`);
    assert.equal(fetchCalls, 0);
});
