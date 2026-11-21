import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { PRACTICE_COMMITTEES } from "./catalog.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMIT_MESSAGES, PRACTICE_LIMITS } from "./limits.ts";
import { PRACTICE_STAFF_ID } from "./people.ts";
import {
    PracticeRequestError,
    routePracticeRequest,
    routePracticeRequestDetailed,
} from "./router.ts";
import { createInitialState } from "./state.ts";

const NOW = new Date("2026-11-21T12:00:00Z");
const MEGABYTE = 1024 * 1024;
const TICKET_EXPIRES_AT = "2026-11-21T12:15:00.000Z";
const TYPE_MESSAGE = "Solo se admiten imágenes JPG o PNG y archivos PDF.";
const SIZE_MESSAGE = "El tamaño del archivo no es válido.";
const NAME_MESSAGE = "El nombre del archivo no es válido.";
const IMAGE_LIMIT_MESSAGE = "El archivo supera el máximo de 2 MB para este tipo.";
const PDF_LIMIT_MESSAGE = "El archivo supera el máximo de 5 MB para este tipo.";
const POLL_MIN_MESSAGE = "Una encuesta debe tener al menos 2 opciones validas";
const POLL_MAX_MESSAGE = "Una encuesta puede tener maximo 10 opciones";
const DELETED_OWN_TEXT = "Esta publicacion fue eliminada por el autor.";

// Muros de la persona y de un comité ajeno para la cuenta de prueba "u1".
const BASE = createInitialState("u1", NOW);
const slugOf = (committee) => `comite-${committee.code.toLowerCase()}`;
const OWN_SLUG = slugOf(PRACTICE_COMMITTEES.find((committee) => committee.id === BASE.persona.committeeId));
const FOREIGN_SLUG = slugOf(PRACTICE_COMMITTEES.find((committee) => committee.id !== BASE.persona.committeeId));

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

const textBody = (overrides = {}) => ({ muro: "general", content: "Hola a todas", post_type: "TEXT", ...overrides });
const pollBody = (pollOptions, overrides = {}) => ({
    muro: "general",
    content: "¿Cuál prefieren?",
    post_type: "POLL",
    poll_options: pollOptions,
    ...overrides,
});
const initBody = (overrides = {}) => ({
    muro: "general",
    file_name: "mapa.png",
    mime_type: "image/png",
    size: 100 * 1024,
    ...overrides,
});

const publish = (body) => call("POST", "/posts", body).post;
const initUpload = (overrides) => call("POST", "/posts/attachments/init", initBody(overrides)).upload;
// Publicación de la persona con un adjunto subido en General.
const attachedPost = (content = "Mapa de la sala") => {
    const upload = initUpload();
    return call("POST", "/posts", textBody({ content, upload_id: upload.id })).post;
};
const ownPosts = () => state.posts.filter((post) => post.authorId === PRACTICE_MEMBERSHIP_ID);
const generalPosts = () => call("GET", "/posts?muro=general").posts;

// Publicaciones sembradas de otras personas (la semilla no crea nada de la persona).
const generalTextOfOther = () =>
    state.posts.find(
        (post) =>
            post.wallSlug === "general" &&
            post.authorId !== PRACTICE_MEMBERSHIP_ID &&
            post.poll === null &&
            post.attachment === null,
    );
const generalPollOfOther = () => state.posts.find((post) => post.wallSlug === "general" && post.poll !== null);
const generalImageOfOther = () =>
    state.posts.find((post) => post.attachment !== null && post.authorId !== PRACTICE_MEMBERSHIP_ID);
const foreignPost = () => state.posts.find((post) => post.wallSlug === FOREIGN_SLUG);
const staffPost = () => state.posts.find((post) => post.authorId === PRACTICE_STAFF_ID);

test("publicar TEXT: queda primero en General con commentCount 0 y canDelete", () => {
    const post = publish(textBody({ content: "  Hola a todas  " }));
    assert.equal(post.content, "Hola a todas");
    assert.equal(post.postType, "TEXT");
    assert.equal(post.user.id, PRACTICE_MEMBERSHIP_ID);
    assert.equal(post.isDeleted, false);
    assert.equal(post.poll, null);
    assert.equal(post.attachment, null);
    const [first] = generalPosts();
    assert.equal(first.id, post.id);
    assert.equal(first.commentCount, 0);
    assert.equal(first.canDelete, true);
});

test("ids: la publicación usa el siguiente número del contador y avanza seq", () => {
    const before = state.seq;
    const post = publish(textBody());
    assert.equal(post.id, `practice-post-${before}`);
    assert.equal(state.seq, before + 1);
});

test("publicar: contenido vacío, con solo espacios o ausente da 400", () => {
    for (const content of ["", "   ", undefined]) {
        assertFails(() => call("POST", "/posts", textBody({ content })), 400, "El contenido es obligatorio");
    }
});

test("publicar: el contenido se valida antes que la encuesta y el muro", () => {
    assertFails(
        () => call("POST", "/posts", pollBody(["a"], { content: " ", muro: "no-existe" })),
        400,
        "El contenido es obligatorio",
    );
    assertFails(() => call("POST", "/posts", pollBody(["a"], { muro: "no-existe" })), 400, POLL_MIN_MESSAGE);
    const eleven = Array.from({ length: 11 }, (_, index) => `Opción ${index}`);
    assertFails(() => call("POST", "/posts", pollBody(eleven, { muro: "no-existe" })), 400, POLL_MAX_MESSAGE);
    assertFails(() => call("POST", "/posts", textBody({ muro: "no-existe" })), 404, "Muro no encontrado");
});

test("publicar: muro ajeno da 403 de acceso y Avisos da 403 de permisos", () => {
    assertFails(() => publish(textBody({ muro: FOREIGN_SLUG })), 403, "No tienes acceso a este muro");
    assertFails(() => publish(textBody({ muro: "avisos" })), 403, "No tienes permisos para publicar en este muro");
});

test("publicar encuesta: recorta, descarta vacías y duplicados sin distinguir mayúsculas", () => {
    const post = publish(pollBody(["Sí ", "", "no", "SÍ", "  "]));
    assert.equal(post.postType, "POLL");
    assert.deepEqual(
        post.poll.options.map((option) => option.text),
        ["Sí", "no"],
    );
    assert.ok(post.poll.options.every((option) => option.id.startsWith("practice-opt-")));
    assert.deepEqual(
        { status: post.poll.status, totalVotes: post.poll.totalVotes, canVote: post.poll.canVote, canClose: post.poll.canClose },
        { status: "OPEN", totalVotes: 0, canVote: true, canClose: true },
    );
    assert.ok(post.poll.options.every((option) => option.votes === 0 && option.isSelectedByMe === false));
});

test("publicar encuesta: menos de dos opciones válidas falla, también si solo difieren en mayúsculas", () => {
    for (const options of [undefined, [], ["Sí"], ["  ", ""], ["Sí", "SÍ"], [" uno ", "UNO"]]) {
        assertFails(() => publish(pollBody(options)), 400, POLL_MIN_MESSAGE);
    }
});

test("publicar encuesta: más de 10 opciones válidas falla y 10 con repetidas sí se aceptan", () => {
    const eleven = Array.from({ length: 11 }, (_, index) => `Opción ${index}`);
    assertFails(() => publish(pollBody(eleven)), 400, POLL_MAX_MESSAGE);
    const tenWithRepeat = [...eleven.slice(0, 10), "opción 0"];
    assert.equal(publish(pollBody(tenWithRepeat)).poll.options.length, 10);
});

test("publicar: un post_type desconocido es TEXT y poll_options se ignora", () => {
    const legacy = publish(textBody({ post_type: "LEGACY", poll_options: ["a", "b"] }));
    assert.equal(legacy.postType, "TEXT");
    assert.equal(legacy.poll, null);
    assert.equal(publish(textBody({ poll_options: ["x"] })).poll, null);
});

test("límite de publicaciones: la 31 falla con el mensaje de límite sin cambiar el estado", () => {
    for (let index = 0; index < PRACTICE_LIMITS.maxOwnPosts; index += 1) {
        publish(textBody({ content: `Mensaje ${index}` }));
    }
    assert.equal(ownPosts().length, PRACTICE_LIMITS.maxOwnPosts);
    const snapshot = structuredClone(state);
    assertFails(() => publish(textBody({ content: "Mensaje 31" })), 400, PRACTICE_LIMIT_MESSAGES.ownPosts);
    assert.deepEqual(state, snapshot);
});

test("límite de publicaciones: borrar no libera huecos, el contador cuenta las creadas", () => {
    const posts = Array.from({ length: PRACTICE_LIMITS.maxOwnPosts }, (_, index) =>
        publish(textBody({ content: `Mensaje ${index}` })),
    );
    call("DELETE", `/posts/${posts[0].id}`);
    assertFails(() => publish(textBody()), 400, PRACTICE_LIMIT_MESSAGES.ownPosts);
});

test("adjuntos: tipo no admitido da 400", () => {
    for (const mime_type of ["image/gif", "text/plain", "", undefined]) {
        assertFails(
            () => call("POST", "/posts/attachments/init", initBody({ mime_type })),
            400,
            TYPE_MESSAGE,
        );
    }
});

test("adjuntos: tamaño que no es un entero positivo da 400", () => {
    for (const size of [0, -1, 1.5, "100", Number.NaN, undefined]) {
        assertFails(
            () => call("POST", "/posts/attachments/init", initBody({ size })),
            400,
            SIZE_MESSAGE,
        );
    }
});

test("adjuntos: imagen de más de 2 MB da 400 y exactamente 2 MB se admite", () => {
    assertFails(() => initUpload({ size: 2 * MEGABYTE + 1 }), 400, IMAGE_LIMIT_MESSAGE);
    assert.match(initUpload({ size: 2 * MEGABYTE }).id, /^practice-upload-\d+$/);
});

test("adjuntos: PDF de más de 5 MB da 400 y exactamente 5 MB se admite", () => {
    const pdf = { mime_type: "application/pdf", file_name: "procedimiento.pdf" };
    assertFails(() => initUpload({ ...pdf, size: 5 * MEGABYTE + 1 }), 400, PDF_LIMIT_MESSAGE);
    assert.match(initUpload({ ...pdf, size: 5 * MEGABYTE }).id, /^practice-upload-\d+$/);
});

test("adjuntos: nombre vacío, con control o de más de 255 caracteres da 400", () => {
    for (const file_name of ["", "   ", "a\u0007b.png", "x".repeat(256)]) {
        assertFails(
            () => call("POST", "/posts/attachments/init", initBody({ file_name })),
            400,
            NAME_MESSAGE,
        );
    }
    assert.match(initUpload({ file_name: `${"x".repeat(251)}.png` }).id, /^practice-upload-\d+$/);
});

test("adjuntos: las reglas del ticket se evalúan en orden: tipo, tamaño, límite, nombre y muro", () => {
    const init = (overrides) => call("POST", "/posts/attachments/init", initBody(overrides));
    assertFails(() => init({ mime_type: "image/gif", size: 0, file_name: "", muro: "no-existe" }), 400, TYPE_MESSAGE);
    assertFails(() => init({ size: 0, file_name: "", muro: "no-existe" }), 400, SIZE_MESSAGE);
    assertFails(() => init({ size: 3 * MEGABYTE, file_name: "", muro: "no-existe" }), 400, IMAGE_LIMIT_MESSAGE);
    assertFails(() => init({ file_name: "", muro: "no-existe" }), 400, NAME_MESSAGE);
    assertFails(() => init({ muro: "no-existe" }), 404, "Muro no encontrado");
    assertFails(() => init({ muro: FOREIGN_SLUG }), 403, "No tienes acceso a este muro");
    assertFails(() => init({ muro: "avisos" }), 403, "No tienes permisos para publicar en este muro");
});

test("adjuntos: el ticket tiene la forma del contrato y queda pendiente en el estado", () => {
    const before = state.seq;
    const { upload } = call("POST", "/posts/attachments/init", initBody({ file_name: "  mapa.png  " }));
    assert.deepEqual(upload, {
        id: `practice-upload-${before}`,
        url: `practice-upload://practice-upload-${before}`,
        method: "PUT",
        headers: {},
        expiresAt: TICKET_EXPIRES_AT,
    });
    assert.deepEqual(state.uploads, [
        { id: upload.id, wallSlug: "general", fileName: "mapa.png", mimeType: "image/png", size: 100 * 1024, postId: null },
    ]);
});

test("límite de adjuntos: dos adjuntos de la persona bloquean el tercer ticket; los sembrados no cuentan", () => {
    attachedPost("Primero");
    attachedPost("Segundo");
    assertFails(() => initUpload(), 400, PRACTICE_LIMIT_MESSAGES.attachments);
});

test("límite de adjuntos: los tickets pendientes cuentan para el límite", () => {
    initUpload();
    initUpload();
    assertFails(() => initUpload(), 400, PRACTICE_LIMIT_MESSAGES.attachments);
});

test("límite de adjuntos: un ticket consumido cuenta una sola vez", () => {
    const upload = initUpload();
    call("POST", "/posts", textBody({ upload_id: upload.id }));
    assert.match(initUpload().id, /^practice-upload-\d+$/);
    assertFails(() => initUpload(), 400, PRACTICE_LIMIT_MESSAGES.attachments);
});

test("publicar con upload_id: el post trae el adjunto con canRemove y se ve en el muro", () => {
    const upload = initUpload({ file_name: "  mapa.png  " });
    const post = call("POST", "/posts", textBody({ content: "Mapa de la sala", upload_id: upload.id })).post;
    assert.match(post.attachment.id, /^practice-att-\d+$/);
    assert.deepEqual(post.attachment, {
        id: post.attachment.id,
        name: "mapa.png",
        mimeType: "image/png",
        size: 100 * 1024,
        canRemove: true,
    });
    const shown = generalPosts().find((item) => item.id === post.id);
    assert.deepEqual(shown.attachment, post.attachment);
});

test("publicar con un upload_id ya consumido devuelve el mismo post sin duplicarlo", () => {
    const upload = initUpload();
    const first = call("POST", "/posts", textBody({ upload_id: upload.id })).post;
    const replay = call("POST", "/posts", textBody({ upload_id: upload.id })).post;
    assert.deepEqual(replay, first);
    assert.equal(ownPosts().length, 1);
});

test("publicar con upload_id: malformado, inexistente o de otro muro da su error", () => {
    for (const upload_id of [5, "", "   "]) {
        assertFails(() => call("POST", "/posts", textBody({ upload_id })), 400, "upload_id no es válido");
    }
    assertFails(
        () => call("POST", "/posts", textBody({ upload_id: "practice-upload-999" })),
        404,
        "Subida no encontrada",
    );
    const upload = initUpload();
    assertFails(
        () => call("POST", "/posts", textBody({ muro: OWN_SLUG, upload_id: upload.id })),
        400,
        "La subida corresponde a otro muro",
    );
    assert.equal(ownPosts().length, 0);
});

test("votar: option_id vacío o ausente da 400", () => {
    const poll = generalPollOfOther();
    for (const body of [undefined, {}, { option_id: "" }, { option_id: "   " }]) {
        assertFails(() => call("POST", `/posts/${poll.id}/poll/vote`, body), 400, "option_id es requerido");
    }
});

test("votar: publicación inexistente da 404", () => {
    assertFails(
        () => call("POST", "/posts/practice-post-999/poll/vote", { option_id: "practice-opt-1" }),
        404,
        "Post no encontrado en este evento",
    );
});

test("votar: en un muro ajeno da 403 aunque el post no sea encuesta", () => {
    assertFails(
        () => call("POST", `/posts/${foreignPost().id}/poll/vote`, { option_id: "practice-opt-1" }),
        403,
        "No tienes acceso a este post",
    );
});

test("votar: en una publicación que no es encuesta da 400", () => {
    assertFails(
        () => call("POST", `/posts/${generalTextOfOther().id}/poll/vote`, { option_id: "practice-opt-1" }),
        400,
        "Este post no es una encuesta",
    );
});

test("votar: opción que no pertenece a la encuesta da 404", () => {
    const poll = generalPollOfOther();
    assertFails(
        () => call("POST", `/posts/${poll.id}/poll/vote`, { option_id: "practice-opt-999" }),
        404,
        "Opcion de encuesta no encontrada",
    );
});

test("votar: el voto reemplaza al anterior y cada persona cuenta una sola vez", () => {
    const seeded = generalPollOfOther();
    const [optionA, optionB] = seeded.poll.options;
    const votesFor = (optionId) => Object.values(seeded.poll.votes).filter((vote) => vote === optionId).length;
    const total = Object.keys(seeded.poll.votes).length;
    const beforeA = votesFor(optionA.id);
    const beforeB = votesFor(optionB.id);

    const first = call("POST", `/posts/${seeded.id}/poll/vote`, { option_id: optionA.id }).post;
    assert.equal(first.poll.totalVotes, total + 1);
    assert.equal(first.poll.options[0].votes, beforeA + 1);
    assert.equal(first.poll.options[0].isSelectedByMe, true);

    const switched = call("POST", `/posts/${seeded.id}/poll/vote`, { option_id: optionB.id }).post;
    assert.equal(switched.poll.totalVotes, total + 1);
    const [viewA, viewB] = switched.poll.options;
    assert.equal(viewA.votes, beforeA);
    assert.equal(viewB.votes, beforeB + 1);
    assert.equal(viewA.isSelectedByMe, false);
    assert.equal(viewB.isSelectedByMe, true);
});

test("votar: una encuesta cerrada da 400 antes de comprobar la opción", () => {
    const poll = publish(pollBody(["A", "B"]));
    call("POST", `/posts/${poll.id}/poll/close`);
    assertFails(
        () => call("POST", `/posts/${poll.id}/poll/vote`, { option_id: poll.poll.options[0].id }),
        400,
        "La encuesta esta cerrada",
    );
    assertFails(
        () => call("POST", `/posts/${poll.id}/poll/vote`, { option_id: "practice-opt-999" }),
        400,
        "La encuesta esta cerrada",
    );
});

test("cerrar: encuesta ajena da 403 Solo el creador", () => {
    assertFails(
        () => call("POST", `/posts/${generalPollOfOther().id}/poll/close`),
        403,
        "Solo el creador puede cerrar esta encuesta",
    );
});

test("cerrar: la autoría se comprueba antes que el estado de la encuesta ajena", () => {
    const seeded = generalPollOfOther();
    seeded.poll.status = "CLOSED";
    assertFails(
        () => call("POST", `/posts/${seeded.id}/poll/close`),
        403,
        "Solo el creador puede cerrar esta encuesta",
    );
});

test("cerrar: la encuesta propia queda cerrada y repetirlo responde igual sin escribir", () => {
    const poll = publish(pollBody(["A", "B"]));
    const closed = call("POST", `/posts/${poll.id}/poll/close`).post;
    assert.equal(closed.poll.status, "CLOSED");
    assert.equal(closed.poll.isClosed, true);
    assert.equal(closed.poll.canVote, false);
    assert.equal(closed.poll.canClose, false);
    const again = outcome("POST", `/posts/${poll.id}/poll/close`);
    assert.deepEqual(again.result, { post: closed });
    assert.equal(again.wrote, false);
});

test("cerrar: publicación que no es encuesta da 400 y en muro ajeno da 403", () => {
    const text = publish(textBody());
    assertFails(() => call("POST", `/posts/${text.id}/poll/close`), 400, "Este post no es una encuesta");
    assertFails(
        () => call("POST", `/posts/${foreignPost().id}/poll/close`),
        403,
        "No tienes acceso a este post",
    );
});

test("borrar publicación propia: queda oculta y sus acciones dan 404", () => {
    const post = publish(textBody({ content: "Para borrar" }));
    const deleted = call("DELETE", `/posts/${post.id}`).post;
    assert.equal(deleted.isDeleted, true);
    assert.equal(deleted.deletedByActorType, "AUTHOR");
    assert.equal(deleted.content, DELETED_OWN_TEXT);
    assert.equal(deleted.canDelete, false);
    assert.equal(deleted.attachment, null);
    assert.equal(generalPosts().some((item) => item.id === post.id), false);
    assertFails(() => call("DELETE", `/posts/${post.id}`), 404, "Post no encontrado en este evento");
    assertFails(() => call("GET", `/posts/${post.id}/comments`), 404, "Post no encontrado en este evento");
});

test("borrar encuesta propia: votar y cerrar después dan 404", () => {
    const poll = publish(pollBody(["A", "B"]));
    const deleted = call("DELETE", `/posts/${poll.id}`).post;
    assert.equal(deleted.poll.canVote, false);
    assert.equal(deleted.poll.canClose, false);
    assertFails(
        () => call("POST", `/posts/${poll.id}/poll/vote`, { option_id: poll.poll.options[0].id }),
        404,
        "Post no encontrado en este evento",
    );
    assertFails(() => call("POST", `/posts/${poll.id}/poll/close`), 404, "Post no encontrado en este evento");
});

test("borrar: publicación ajena da 403 de permisos, la de Avisos también", () => {
    assertFails(
        () => call("DELETE", `/posts/${generalTextOfOther().id}`),
        403,
        "No tienes permisos para eliminar esta publicacion",
    );
    assertFails(
        () => call("DELETE", `/posts/${staffPost().id}`),
        403,
        "No tienes permisos para eliminar esta publicacion",
    );
});

test("borrar: publicación de un comité ajeno da 403 de acceso y una inexistente da 404", () => {
    assertFails(() => call("DELETE", `/posts/${foreignPost().id}`), 403, "No tienes acceso a este post");
    assertFails(
        () => call("DELETE", "/posts/practice-post-999"),
        404,
        "Post no encontrado en este evento",
    );
});

test("borrar publicación con adjunto: libera el binario y su subida", () => {
    const upload = initUpload();
    const post = call("POST", "/posts", textBody({ upload_id: upload.id })).post;
    const { result, released, wrote } = outcome("DELETE", `/posts/${post.id}`);
    assert.deepEqual(released, [post.attachment.id]);
    assert.equal(wrote, true);
    assert.equal(result.post.attachment, null);
    assert.equal(state.uploads.some((item) => item.id === upload.id), false);
});

test("retirar adjunto propio: devuelve sus ids, libera el binario y deja la publicación visible", () => {
    const post = attachedPost("Con mapa");
    const { result, released } = outcome("DELETE", `/posts/${post.id}/attachment`);
    assert.deepEqual(result, { removed: true, postId: post.id, attachmentId: post.attachment.id });
    assert.deepEqual(released, [post.attachment.id]);
    const shown = generalPosts().find((item) => item.id === post.id);
    assert.equal(shown.attachment, null);
    assert.equal(shown.isDeleted, false);
});

test("retirar adjunto: ajeno da 403, sin adjunto da 404 y una publicación inexistente da 404", () => {
    assertFails(
        () => call("DELETE", `/posts/${generalImageOfOther().id}/attachment`),
        403,
        "Solo el autor puede retirar el adjunto",
    );
    const text = publish(textBody());
    assertFails(() => call("DELETE", `/posts/${text.id}/attachment`), 404, "El post no tiene adjunto");
    assertFails(
        () => call("DELETE", "/posts/practice-post-999/attachment"),
        404,
        "Post no encontrado en este evento",
    );
});

test("routePracticeRequestDetailed: las lecturas no escriben y una escritura correcta sí", () => {
    const read = routePracticeRequestDetailed({ method: "GET", path: "/posts?muro=general" }, state, { now: NOW });
    assert.equal(read.wrote, false);
    assert.deepEqual(read.released, []);
    const write = routePracticeRequestDetailed(
        { method: "POST", path: "/posts", body: textBody() },
        state,
        { now: NOW },
    );
    assert.equal(write.wrote, true);
    assert.equal(write.result.post.content, "Hola a todas");
});

test("routePracticeRequestDetailed: un voto repetido no marca wrote", () => {
    const poll = generalPollOfOther();
    const path = `/posts/${poll.id}/poll/vote`;
    const body = { option_id: poll.poll.options[0].id };
    assert.equal(outcome("POST", path, body).wrote, true);
    assert.equal(outcome("POST", path, body).wrote, false);
});

test("una escritura rechazada no deja el estado a medias", () => {
    const poll = generalPollOfOther();
    const requests = [
        ["POST", "/posts", textBody({ content: " " })],
        ["POST", "/posts", pollBody(["solo"])],
        ["POST", "/posts/attachments/init", initBody({ mime_type: "image/gif" })],
        ["POST", "/posts", textBody({ upload_id: "practice-upload-999" })],
        ["DELETE", `/posts/${generalTextOfOther().id}`],
        ["DELETE", `/posts/${poll.id}/attachment`],
        ["POST", `/posts/${poll.id}/poll/close`],
        ["POST", `/posts/${poll.id}/poll/vote`, { option_id: "practice-opt-999" }],
    ];
    for (const [method, path, body] of requests) {
        const snapshot = structuredClone(state);
        assert.throws(() => call(method, path, body), PracticeRequestError, `${method} ${path}`);
        assert.deepEqual(state, snapshot, `${method} ${path}`);
    }
});

test("límite de publicaciones: el reintento de una confirmación en la publicación 30 responde el mismo post", () => {
    for (let index = 0; index < PRACTICE_LIMITS.maxOwnPosts - 1; index += 1) {
        publish(textBody({ content: `Mensaje ${index}` }));
    }
    const upload = initUpload();
    const last = call("POST", "/posts", textBody({ upload_id: upload.id })).post;
    assert.equal(ownPosts().length, PRACTICE_LIMITS.maxOwnPosts);
    assert.deepEqual(call("POST", "/posts", textBody({ upload_id: upload.id })).post, last);
});

test("encuesta: un post POLL sin datos de encuesta da 404 Encuesta no encontrada", () => {
    const poll = publish(pollBody(["A", "B"]));
    state.posts.find((post) => post.id === poll.id).poll = null;
    assertFails(
        () => call("POST", `/posts/${poll.id}/poll/vote`, { option_id: "practice-opt-1" }),
        404,
        "Encuesta no encontrada",
    );
});

test("subida consumida sin publicación da 409 y no crea nada", () => {
    const upload = initUpload();
    state.uploads.find((item) => item.id === upload.id).postId = "practice-post-404";
    const snapshot = structuredClone(state);
    assertFails(
        () => call("POST", "/posts", textBody({ upload_id: upload.id })),
        409,
        "Esta subida ya se está procesando o se descartó. Sube el archivo de nuevo.",
    );
    assert.deepEqual(state, snapshot);
});

test("ninguna escritura de la práctica llama a fetch", () => {
    publish(textBody());
    initUpload();
    call("POST", `/posts/${generalPollOfOther().id}/poll/vote`, { option_id: generalPollOfOther().poll.options[1].id });
    assert.equal(fetchCalls, 0);
});
