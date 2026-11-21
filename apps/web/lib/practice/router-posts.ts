import type { EventWall } from "../../types/common.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMIT_MESSAGES, PRACTICE_LIMITS } from "./limits.ts";
import type { PracticePoll, PracticePost, PracticeUpload } from "./model.ts";
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
import { toPost, toPostDeleted, type PracticePostView } from "./views.ts";

// Escrituras de publicaciones, encuestas y metadatos de adjuntos. Cada manejador valida todo antes
// de mutar el estado y usa state.seq para los ids; la fecha sale de context.now.

const BYTES_PER_MEGABYTE = 1024 * 1024;
const IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png"];
const PDF_TYPE = "application/pdf";
// Un ticket de subida vive 15 minutos, como en la API.
const UPLOAD_TTL_MS = 15 * 60 * 1000;
const MAX_FILE_NAME_LENGTH = 255;
const CONTROL_CHARACTER = /\p{Cc}/u;

const TYPE_MESSAGE = "Solo se admiten imágenes JPG o PNG y archivos PDF.";
const SIZE_MESSAGE = "El tamaño del archivo no es válido.";
const NAME_MESSAGE = "El nombre del archivo no es válido.";
const CONTENT_MESSAGE = "El contenido es obligatorio";
const POLL_MIN_MESSAGE = "Una encuesta debe tener al menos 2 opciones validas";
const POLL_MAX_MESSAGE = "Una encuesta puede tener maximo 10 opciones";

type UploadTicket = {
    id: string;
    url: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresAt: string;
};

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;

// Límite local en bytes del tipo admitido; null si el tipo no se admite.
const maxBytesFor = (mimeType: string): number | null => {
    if (IMAGE_TYPES.includes(mimeType)) {
        return PRACTICE_LIMITS.maxImageBytes;
    }
    return mimeType === PDF_TYPE ? PRACTICE_LIMITS.maxPdfBytes : null;
};

// Nombre sin espacios sobrantes, de 1 a 255 caracteres y sin caracteres de control; null si no es válido.
const cleanFileName = (value: unknown): string | null => {
    const name = textOf(value).trim();
    if (name === "" || Array.from(name).length > MAX_FILE_NAME_LENGTH || CONTROL_CHARACTER.test(name)) {
        return null;
    }
    return name;
};

// Recorta, descarta vacías y repetidas sin distinguir mayúsculas; conserva la primera aparición.
const normalizePollOptions = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set<string>();
    const options: string[] = [];
    for (const item of value) {
        const text = textOf(item).trim();
        const key = text.toLowerCase();
        if (text !== "" && !seen.has(key)) {
            seen.add(key);
            options.push(text);
        }
    }
    return options;
};

// upload_id ausente o null no adjunta nada; presente pero no texto o vacío es un error de formato.
const uploadIdOf = (value: unknown): string | null => {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== "string" || value.trim() === "") {
        throw new PracticeRequestError(400, "upload_id no es válido");
    }
    return value;
};

// Publicaciones creadas por la persona, también las borradas: el límite cuenta lo creado.
const ownPostCount = (state: PracticeState): number =>
    state.posts.filter((post) => post.authorId === PRACTICE_MEMBERSHIP_ID).length;

// Adjuntos que ocupan espacio: solo los de publicaciones propias. Los tickets pendientes y los sembrados no cuentan.
const ownAttachmentCount = (state: PracticeState): number =>
    state.posts.filter((post) => post.authorId === PRACTICE_MEMBERSHIP_ID && post.attachment !== null).length;

// Publicación que ya consumió el ticket, si la hay.
const replayedPost = (state: PracticeState, uploadId: string): PracticePost | null => {
    const upload = state.uploads.find((item) => item.id === uploadId);
    if (upload === undefined || upload.postId === null) {
        return null;
    }
    return state.posts.find((post) => post.id === upload.postId) ?? null;
};

// Ticket que una publicación nueva va a consumir: debe existir, ser de ese muro y seguir pendiente.
const pendingUploadOrThrow = (state: PracticeState, uploadId: string, wallSlug: string): PracticeUpload => {
    const upload = state.uploads.find((item) => item.id === uploadId);
    if (upload === undefined) {
        throw new PracticeRequestError(404, "Subida no encontrada");
    }
    if (upload.wallSlug !== wallSlug) {
        throw new PracticeRequestError(400, "La subida corresponde a otro muro");
    }
    if (upload.postId !== null) {
        throw new PracticeRequestError(
            409,
            "Esta subida ya se está procesando o se descartó. Sube el archivo de nuevo.",
        );
    }
    return upload;
};

// Muro donde la persona puede publicar: además de tener acceso, debe permitir publicar (Avisos no).
const publishableWallOrThrow = (state: PracticeState, slug: string): EventWall => {
    const wall = readableWallOrThrow(state, slug, "No tienes acceso a este muro");
    if (!wall.canPublish) {
        throw new PracticeRequestError(403, "No tienes permisos para publicar en este muro");
    }
    return wall;
};

// Encuesta de la publicación: 400 si no es encuesta; 404 si, siendo POLL, le falta la fila de encuesta.
const pollOf = (post: PracticePost): PracticePoll => {
    if (post.postType !== "POLL") {
        throw new PracticeRequestError(400, "Este post no es una encuesta");
    }
    if (post.poll === null) {
        throw new PracticeRequestError(404, "Encuesta no encontrada");
    }
    return post.poll;
};

// Quita el adjunto de una publicación propia: desaparece su subida y el binario queda para que la pasarela lo borre.
// Solo se llama con publicaciones de la persona; las sembradas nunca tienen binario guardado.
const releaseAttachment = (context: PracticeRouteContext, post: PracticePost): void => {
    if (post.attachment === null) {
        return;
    }
    context.released.push(post.attachment.id);
    context.state.uploads = context.state.uploads.filter((upload) => upload.postId !== post.id);
    post.attachment = null;
};

// POST /posts/attachments/init: registra un ticket pendiente con los metadatos del archivo. El binario no pasa por aquí.
export const handleAttachmentInit = (context: PracticeRouteContext): { upload: UploadTicket } => {
    const { state, now } = context;
    const input = bodyOf(context.body);
    const mimeType = textOf(input.mime_type);
    const maxBytes = maxBytesFor(mimeType);
    if (maxBytes === null) {
        throw new PracticeRequestError(400, TYPE_MESSAGE);
    }
    const size = input.size;
    if (!isPositiveInteger(size)) {
        throw new PracticeRequestError(400, SIZE_MESSAGE);
    }
    if (size > maxBytes) {
        throw new PracticeRequestError(
            400,
            `El archivo supera el máximo de ${maxBytes / BYTES_PER_MEGABYTE} MB para este tipo.`,
        );
    }
    const fileName = cleanFileName(input.file_name);
    if (fileName === null) {
        throw new PracticeRequestError(400, NAME_MESSAGE);
    }
    const wall = publishableWallOrThrow(state, textOf(input.muro));
    if (ownAttachmentCount(state) >= PRACTICE_LIMITS.maxAttachments) {
        throw new PracticeRequestError(400, PRACTICE_LIMIT_MESSAGES.attachments);
    }

    // Un solo ticket en vuelo: los pendientes anteriores quedaron huérfanos, el archivo vive solo en memoria.
    state.uploads = state.uploads.filter((upload) => upload.postId !== null);
    const id = nextId(state, "upload");
    state.uploads.push({ id, wallSlug: wall.slug, fileName, mimeType, size, postId: null });
    context.wrote = true;
    return {
        upload: {
            id,
            url: `practice-upload://${id}`,
            method: "PUT",
            headers: {},
            expiresAt: new Date(now.getTime() + UPLOAD_TTL_MS).toISOString(),
        },
    };
};

// POST /posts: crea una publicación de texto o de encuesta; con upload_id adjunta el archivo del ticket.
export const handlePostCreate = (context: PracticeRouteContext): { post: PracticePostView } => {
    const { state, now } = context;
    const input = bodyOf(context.body);
    const content = textOf(input.content).trim();
    if (content === "") {
        throw new PracticeRequestError(400, CONTENT_MESSAGE);
    }
    // Todo tipo distinto de POLL (también los antiguos) se guarda como TEXT y poll_options se ignora.
    const isPoll = input.post_type === "POLL";
    const pollTexts = isPoll ? normalizePollOptions(input.poll_options) : [];
    if (isPoll && pollTexts.length < PRACTICE_LIMITS.minPollOptions) {
        throw new PracticeRequestError(400, POLL_MIN_MESSAGE);
    }
    if (isPoll && pollTexts.length > PRACTICE_LIMITS.maxPollOptions) {
        throw new PracticeRequestError(400, POLL_MAX_MESSAGE);
    }
    const wall = publishableWallOrThrow(state, textOf(input.muro));
    const uploadId = uploadIdOf(input.upload_id);

    // Reintento de una confirmación ya hecha: devuelve la misma publicación sin contar otra vez.
    if (uploadId !== null) {
        const replayed = replayedPost(state, uploadId);
        if (replayed !== null) {
            return { post: toPost(state, replayed) };
        }
    }
    if (ownPostCount(state) >= PRACTICE_LIMITS.maxOwnPosts) {
        throw new PracticeRequestError(400, PRACTICE_LIMIT_MESSAGES.ownPosts);
    }
    const upload = uploadId === null ? null : pendingUploadOrThrow(state, uploadId, wall.slug);

    // Todo validado: a partir de aquí solo se escribe.
    const post: PracticePost = {
        id: nextId(state, "post"),
        authorId: PRACTICE_MEMBERSHIP_ID,
        wallSlug: wall.slug,
        postType: isPoll ? "POLL" : "TEXT",
        content,
        createdAt: now.toISOString(),
        pinned: false,
        deleted: false,
        poll: isPoll
            ? {
                  status: "OPEN",
                  options: pollTexts.map((text) => ({ id: nextId(state, "opt"), text })),
                  votes: {},
              }
            : null,
        attachment: null,
    };
    if (upload !== null) {
        post.attachment = {
            id: nextId(state, "att"),
            name: upload.fileName,
            mimeType: upload.mimeType,
            size: upload.size,
        };
        upload.postId = post.id;
    }
    state.posts.push(post);
    context.wrote = true;
    return { post: toPost(state, post) };
};

// DELETE /posts/:postId: solo el autor borra. La publicación queda marcada como borrada y su adjunto se libera.
export const handlePostDelete = (context: PracticeRouteContext): { post: PracticePostView } => {
    const { state } = context;
    const post = visiblePostOrThrow(state, requireParam(context.params, "postId"));
    readableWallOrThrow(state, post.wallSlug, "No tienes acceso a este post");
    if (post.authorId !== PRACTICE_MEMBERSHIP_ID) {
        throw new PracticeRequestError(403, "No tienes permisos para eliminar esta publicacion");
    }
    releaseAttachment(context, post);
    post.deleted = true;
    context.wrote = true;
    return { post: toPostDeleted(state, post) };
};

// DELETE /posts/:postId/attachment: retira el adjunto de una publicación propia.
export const handleAttachmentRemove = (
    context: PracticeRouteContext,
): { removed: true; postId: string; attachmentId: string } => {
    const post = visiblePostOrThrow(context.state, requireParam(context.params, "postId"));
    if (post.authorId !== PRACTICE_MEMBERSHIP_ID) {
        throw new PracticeRequestError(403, "Solo el autor puede retirar el adjunto");
    }
    if (post.attachment === null) {
        throw new PracticeRequestError(404, "El post no tiene adjunto");
    }
    const attachmentId = post.attachment.id;
    releaseAttachment(context, post);
    context.wrote = true;
    return { removed: true, postId: post.id, attachmentId };
};

// POST /posts/:postId/poll/vote: el voto reemplaza al anterior mientras la encuesta esté abierta.
export const handlePollVote = (context: PracticeRouteContext): { post: PracticePostView } => {
    const { state } = context;
    const optionId = textOf(bodyOf(context.body).option_id);
    if (optionId.trim() === "") {
        throw new PracticeRequestError(400, "option_id es requerido");
    }
    const post = visiblePostOrThrow(state, requireParam(context.params, "postId"));
    readableWallOrThrow(state, post.wallSlug, "No tienes acceso a este post");
    const poll = pollOf(post);
    if (poll.status === "CLOSED") {
        throw new PracticeRequestError(400, "La encuesta esta cerrada");
    }
    if (!poll.options.some((option) => option.id === optionId)) {
        throw new PracticeRequestError(404, "Opcion de encuesta no encontrada");
    }
    if (poll.votes[PRACTICE_MEMBERSHIP_ID] !== optionId) {
        poll.votes[PRACTICE_MEMBERSHIP_ID] = optionId;
        context.wrote = true;
    }
    return { post: toPost(state, post) };
};

// POST /posts/:postId/poll/close: solo quien creó la encuesta la cierra; repetirlo no escribe nada.
export const handlePollClose = (context: PracticeRouteContext): { post: PracticePostView } => {
    const { state } = context;
    const post = visiblePostOrThrow(state, requireParam(context.params, "postId"));
    readableWallOrThrow(state, post.wallSlug, "No tienes acceso a este post");
    const poll = pollOf(post);
    if (post.authorId !== PRACTICE_MEMBERSHIP_ID) {
        throw new PracticeRequestError(403, "Solo el creador puede cerrar esta encuesta");
    }
    if (poll.status === "OPEN") {
        poll.status = "CLOSED";
        context.wrote = true;
    }
    return { post: toPost(state, post) };
};
