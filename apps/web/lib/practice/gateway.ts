import { openPracticeStorage } from "./indexeddb-storage.ts";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMIT_MESSAGES, PRACTICE_LIMITS } from "./limits.ts";
import { seedBlobFor } from "./seed-files.ts";
import {
    PRACTICE_UNAVAILABLE_MESSAGE,
    PracticeRequestError,
    practiceRouteOf,
    routePracticeRequestDetailed,
    type PracticeOutcome,
    type PracticeRequest,
} from "./router.ts";
import { bodyOf } from "./router-shared.ts";
import type { PracticeState } from "./state.ts";
import { createMemoryStorage, loadOrInitState, type PracticeStorage } from "./storage.ts";
import { peekPracticeFile, stashPracticeFile, takePracticeFile } from "./uploads.ts";

// Pasarela del modo práctica: por usuario guarda un almacén, el estado cargado y las URL temporales de
// descarga, y resuelve las peticiones con el enrutador local. Cada escritura se guarda antes de responder;
// los binarios van al almacén y salen del navegador solo como URL blob:. No usa la red en ningún caso.

export type PracticeStorageFactory = (userId: string) => Promise<PracticeStorage>;

type PracticeInput = {
    userId: string;
    method: string;
    path: string;
    body?: unknown;
};

type PracticeSession = {
    storage: PracticeStorage;
    persistent: boolean;
    // Estado cargado o creado para el usuario; null después de reiniciar la práctica.
    state: Promise<PracticeState> | null;
    // Cola de peticiones del usuario: cada una espera a la anterior, así una reversión nunca pisa otra escritura.
    queue: Promise<unknown>;
    // URL temporales de descarga por id de adjunto; se revocan al retirar el adjunto o al reiniciar.
    objectUrls: Map<string, string[]>;
};

const CREATE_POST_ROUTE = "POST /posts";
const ATTACHMENT_DOWNLOAD_ROUTE = "GET /posts/:postId/attachment/download";
// Vigencia que anuncia la descarga, como en la API real. La URL blob: sigue viva hasta revocarla.
const DOWNLOAD_TTL_MS = 60 * 1000;

// Fábrica inyectada solo para pruebas. Con ella el almacén cuenta como persistente hasta que falle.
let injectedFactory: PracticeStorageFactory | null = null;
const sessions = new Map<string, Promise<PracticeSession>>();

// Sustituye el almacén por una fábrica (pruebas) o lo restaura con null. Descarta las sesiones abiertas.
export const setPracticeStorageFactory = (factory: PracticeStorageFactory | null): void => {
    injectedFactory = factory;
    sessions.clear();
};

const newSession = (storage: PracticeStorage, persistent: boolean): PracticeSession => ({
    storage,
    persistent,
    state: null,
    queue: Promise.resolve(),
    objectUrls: new Map(),
});

const memorySession = (): PracticeSession => newSession(createMemoryStorage(), false);

// Abre el almacén del usuario. Cualquier fallo (incluido leer indexedDB) cae a memoria sin propagar el error.
const openSession = async (userId: string): Promise<PracticeSession> => {
    try {
        if (injectedFactory) {
            return newSession(await injectedFactory(userId), true);
        }
        const { storage, persistent } = await openPracticeStorage(userId, globalThis.indexedDB);
        return newSession(storage, persistent);
    } catch {
        return memorySession();
    }
};

const sessionFor = (userId: string): Promise<PracticeSession> => {
    let session = sessions.get(userId);
    if (!session) {
        session = openSession(userId);
        sessions.set(userId, session);
    }
    return session;
};

// Si el almacén rechaza una escritura (conexión muerta, cuota), la sesión pasa a memoria: la
// práctica sigue funcionando sin persistencia y la conexión rota no se vuelve a abrir.
const degradeToMemory = (session: PracticeSession): void => {
    session.storage = createMemoryStorage();
    session.persistent = false;
};

const loadState = async (session: PracticeSession, userId: string): Promise<PracticeState> => {
    try {
        return (await loadOrInitState(session.storage, userId, new Date())).state;
    } catch {
        degradeToMemory(session);
        return (await loadOrInitState(session.storage, userId, new Date())).state;
    }
};

const stateFor = (session: PracticeSession, userId: string): Promise<PracticeState> => {
    if (session.state === null) {
        session.state = loadState(session, userId);
    }
    return session.state;
};

// Ejecuta la tarea después de las que ya están en cola para el usuario. La cola nunca se rechaza.
const runExclusive = <T>(session: PracticeSession, task: () => Promise<T>): Promise<T> => {
    const run = session.queue.then(task);
    session.queue = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
};

// Devuelve el estado en memoria a la copia tomada antes de enrutar.
const restoreState = (session: PracticeSession, snapshot: PracticeState): void => {
    session.state = Promise.resolve(snapshot);
};

const revokeAttachmentUrls = (session: PracticeSession, attachmentId: string): void => {
    for (const url of session.objectUrls.get(attachmentId) ?? []) {
        URL.revokeObjectURL(url);
    }
    session.objectUrls.delete(attachmentId);
};

const revokeSessionUrls = (session: PracticeSession): void => {
    for (const attachmentId of [...session.objectUrls.keys()]) {
        revokeAttachmentUrls(session, attachmentId);
    }
};

// Revoca las URL de descarga del usuario sin tocar el estado ni los binarios (el reinicio ya lo hace).
export const revokeAllObjectUrls = async (userId: string): Promise<void> => {
    revokeSessionUrls(await sessionFor(userId));
};

// Borra un binario que el estado ya no referencia. Si falla queda huérfano (el reinicio lo borra) y no
// cambia la respuesta, porque el estado ya está guardado.
const discardBlob = async (storage: PracticeStorage, attachmentId: string): Promise<void> => {
    try {
        await storage.deleteBlob(attachmentId);
    } catch {
        // Huérfano: se elimina al reiniciar la práctica.
    }
};

// Descarga: el binario guardado o, si el adjunto es de la semilla, el generado. Devuelve una URL blob: local.
const attachmentDownload = async (
    session: PracticeSession,
    attachmentId: string,
): Promise<{ url: string; expiresAt: string }> => {
    const blob = (await session.storage.getBlob(attachmentId)) ?? seedBlobFor(attachmentId);
    if (blob === null) {
        throw new PracticeRequestError(404, "El post no tiene adjunto");
    }
    const url = URL.createObjectURL(blob);
    session.objectUrls.set(attachmentId, [...(session.objectUrls.get(attachmentId) ?? []), url]);
    return { url, expiresAt: new Date(Date.now() + DOWNLOAD_TTL_MS).toISOString() };
};

// Tope total: el estado serializado más el tamaño declarado de los adjuntos propios.
const exceedsTotalLimit = (state: PracticeState): boolean => {
    const attachmentBytes = state.posts.reduce(
        (sum, post) =>
            sum + (post.authorId === PRACTICE_MEMBERSHIP_ID && post.attachment !== null ? post.attachment.size : 0),
        0,
    );
    return JSON.stringify(state).length + attachmentBytes > PRACTICE_LIMITS.maxTotalBytes;
};

// upload_id del cuerpo de POST /posts cuando es texto no vacío; cualquier otra forma la valida el enrutador.
const uploadIdOfBody = (body: unknown): string | null => {
    const value = bodyOf(body).upload_id;
    return typeof value === "string" && value.trim() !== "" ? value : null;
};

// Id del adjunto que una publicación acaba de tomar de este ticket; null si el ticket sigue sin consumir.
const attachmentCreatedFrom = (state: PracticeState, uploadId: string): string | null => {
    const postId = state.uploads.find((upload) => upload.id === uploadId)?.postId ?? null;
    if (postId === null) {
        return null;
    }
    return state.posts.find((post) => post.id === postId)?.attachment?.id ?? null;
};

// Un ticket pendiente que la escritura quitó (una subida nueva reemplaza a la anterior) no podrá confirmarse:
// su archivo se descarta del stash.
const discardReplacedTickets = (snapshot: PracticeState, state: PracticeState): void => {
    for (const upload of snapshot.uploads) {
        if (upload.postId === null && !state.uploads.some((item) => item.id === upload.id)) {
            takePracticeFile(upload.id);
        }
    }
};

// Guarda una escritura confirmada. Orden: tope, binario nuevo, estado y, solo después, borrado de los binarios
// liberados. Si el tope o el guardado fallan, el estado vuelve a la copia previa, el binario nuevo se borra y el
// archivo vuelve al stash para que el reintento funcione. Las escrituras de contenido no degradan a memoria.
const persistWrite = async (
    session: PracticeSession,
    state: PracticeState,
    snapshot: PracticeState,
    outcome: PracticeOutcome,
    created: { uploadId: string; attachmentId: string } | null,
): Promise<void> => {
    const { storage } = session;
    if (exceedsTotalLimit(state)) {
        restoreState(session, snapshot);
        throw new PracticeRequestError(507, PRACTICE_LIMIT_MESSAGES.totalBytes);
    }
    let file: File | null = null;
    if (created !== null) {
        file = takePracticeFile(created.uploadId);
        if (file === null) {
            restoreState(session, snapshot);
            throw new PracticeRequestError(404, "Subida no encontrada");
        }
    }

    let blobStored = false;
    try {
        if (created !== null && file !== null) {
            await storage.putBlob(created.attachmentId, file);
            blobStored = true;
        }
        await storage.save(state);
    } catch {
        restoreState(session, snapshot);
        if (blobStored && created !== null) {
            await discardBlob(storage, created.attachmentId);
        }
        if (created !== null && file !== null) {
            stashPracticeFile(created.uploadId, file);
        }
        throw new PracticeRequestError(507, PRACTICE_LIMIT_MESSAGES.totalBytes);
    }

    discardReplacedTickets(snapshot, state);
    for (const attachmentId of outcome.released) {
        revokeAttachmentUrls(session, attachmentId);
        await discardBlob(storage, attachmentId);
    }
};

const executeRequest = async (session: PracticeSession, input: PracticeInput): Promise<unknown> => {
    const state = await stateFor(session, input.userId);
    const request: PracticeRequest = { method: input.method, path: input.path, body: input.body };
    const route = practiceRouteOf(request);

    // La descarga se valida con el enrutador (sin escribir) y después se entrega la URL del binario.
    if (route === ATTACHMENT_DOWNLOAD_ROUTE) {
        const { attachmentId } = routePracticeRequestDetailed(request, state).result as { attachmentId: string };
        return attachmentDownload(session, attachmentId);
    }

    // Confirmar una subida pendiente exige su archivo en el stash antes de enrutar. El archivo no se consume
    // aquí: solo cuando la publicación queda creada (persistWrite). Se mira antes de enrutar porque el
    // enrutador muta el ticket.
    const uploadId = route === CREATE_POST_ROUTE ? uploadIdOfBody(request.body) : null;
    const pendingUploadId =
        uploadId !== null && state.uploads.some((upload) => upload.id === uploadId && upload.postId === null)
            ? uploadId
            : null;
    if (pendingUploadId !== null && peekPracticeFile(pendingUploadId) === null) {
        throw new PracticeRequestError(404, "Subida no encontrada");
    }

    const snapshot = structuredClone(state);
    let outcome: PracticeOutcome;
    try {
        outcome = routePracticeRequestDetailed(request, state);
    } catch (error) {
        restoreState(session, snapshot);
        throw error;
    }
    // Las lecturas no escriben: sin cambios no hay guardado.
    if (!outcome.wrote) {
        return outcome.result;
    }

    const attachmentId = pendingUploadId === null ? null : attachmentCreatedFrom(state, pendingUploadId);
    const created =
        pendingUploadId === null || attachmentId === null ? null : { uploadId: pendingUploadId, attachmentId };
    await persistWrite(session, state, snapshot, outcome, created);
    return outcome.result;
};

// Resuelve una petición del modo práctica. Las peticiones de un mismo usuario se atienden en orden.
export const runPracticeRequest = async (input: PracticeInput): Promise<unknown> => {
    // Entradas que no son texto no tienen ruta válida: se falla cerrado con 501, sin TypeError.
    if (typeof input.method !== "string" || typeof input.path !== "string") {
        throw new PracticeRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE);
    }
    const session = await sessionFor(input.userId);
    return runExclusive(session, () => executeRequest(session, input));
};

// Borra el almacén del usuario, sus binarios de descarga y sus archivos pendientes, y olvida el estado memorizado.
// Solo se descartan los archivos de los tickets de esta cuenta: el stash es compartido, así que nunca se vacía
// entero. Si el borrado falla, la sesión pasa a memoria vacía para no reutilizar datos anteriores; nunca rechaza.
export const resetPractice = async (userId: string): Promise<void> => {
    const session = await sessionFor(userId);
    await runExclusive(session, async () => {
        try {
            const state = await stateFor(session, userId);
            for (const upload of state.uploads) {
                takePracticeFile(upload.id);
            }
        } catch {
            // Sin estado legible no se conocen los tickets de la cuenta: el reinicio sigue y vacía el almacén.
        }
        session.state = null;
        revokeSessionUrls(session);
        try {
            await session.storage.clear();
        } catch {
            degradeToMemory(session);
        }
    });
};

export const getPracticeStatus = async (userId: string): Promise<{ persistent: boolean }> => {
    const session = await sessionFor(userId);
    return { persistent: session.persistent };
};
