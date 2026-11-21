import { openPracticeStorage } from "./indexeddb-storage.ts";
import { PRACTICE_MEMBERSHIP_ID, practiceDbName } from "./constants.ts";
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
import { createMemoryStorage, loadOrInitState, type LoadResult, type PracticeStorage } from "./storage.ts";
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
    // Verdadero si la carga descartó un estado guardado de otra versión o forma (no un reinicio manual).
    wasReset: boolean;
    // Estado cargado o creado para el usuario; null después de reiniciar la práctica.
    state: Promise<PracticeState> | null;
    // Cola de peticiones del usuario: cada una espera a la anterior, así una reversión nunca pisa otra escritura.
    queue: Promise<unknown>;
    // URL temporal de descarga por id de adjunto, reutilizada en la sesión; se revoca al retirar el adjunto,
    // al reiniciar o al cerrar sesión.
    objectUrls: Map<string, string>;
};

const CREATE_POST_ROUTE = "POST /posts";
const ATTACHMENT_DOWNLOAD_ROUTE = "GET /posts/:postId/attachment/download";
// Vigencia que anuncia la descarga, como en la API real. La URL blob: sigue viva hasta revocarla.
const DOWNLOAD_TTL_MS = 60 * 1000;

// Fábrica inyectada solo para pruebas. Con ella el almacén cuenta como persistente hasta que falle.
let injectedFactory: PracticeStorageFactory | null = null;
const sessions = new Map<string, Promise<PracticeSession>>();
// Usuarios que ya cerraron el aviso de reinicio. Vive en memoria y no depende de la sesión: tras recargar,
// el estado guardado ya es la versión nueva y el aviso no vuelve a aparecer.
const acknowledgedResets = new Set<string>();

// Sustituye el almacén por una fábrica (pruebas) o lo restaura con null. Descarta las sesiones abiertas y los avisos cerrados.
export const setPracticeStorageFactory = (factory: PracticeStorageFactory | null): void => {
    injectedFactory = factory;
    sessions.clear();
    acknowledgedResets.clear();
};

const newSession = (storage: PracticeStorage, persistent: boolean): PracticeSession => ({
    storage,
    persistent,
    wasReset: false,
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
    let loaded: LoadResult;
    try {
        loaded = await loadOrInitState(session.storage, userId, new Date());
    } catch {
        degradeToMemory(session);
        loaded = await loadOrInitState(session.storage, userId, new Date());
    }
    session.wasReset = loaded.wasReset;
    return loaded.state;
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
    const url = session.objectUrls.get(attachmentId);
    if (url !== undefined) {
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
    state: PracticeState,
    attachmentId: string,
): Promise<{ url: string; expiresAt: string }> => {
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS).toISOString();
    const existing = session.objectUrls.get(attachmentId);
    if (existing !== undefined) {
        return { url: existing, expiresAt };
    }
    const blob = (await session.storage.getBlob(attachmentId)) ?? seedBlobFor(attachmentId);
    if (blob === null) {
        throw new PracticeRequestError(404, "El post no tiene adjunto");
    }
    // El tipo sale del adjunto validado en el estado, no del que traiga el binario guardado.
    const mimeType = state.posts.find((post) => post.attachment?.id === attachmentId)?.attachment?.mimeType;
    const typed = mimeType === undefined || blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    const url = URL.createObjectURL(typed);
    session.objectUrls.set(attachmentId, url);
    return { url, expiresAt };
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

// Cuota agotada del navegador: solo entonces se culpa al tope de espacio; otros fallos tienen su propio texto.
const isQuotaError = (error: unknown): boolean =>
    typeof error === "object" && error !== null && (error as { name?: unknown }).name === "QuotaExceededError";

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
    } catch (error) {
        restoreState(session, snapshot);
        if (blobStored && created !== null) {
            await discardBlob(storage, created.attachmentId);
        }
        if (created !== null && file !== null) {
            stashPracticeFile(created.uploadId, file);
        }
        throw new PracticeRequestError(
            507,
            isQuotaError(error) ? PRACTICE_LIMIT_MESSAGES.totalBytes : PRACTICE_LIMIT_MESSAGES.saveFailed,
        );
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
        return attachmentDownload(session, state, attachmentId);
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

    // Las lecturas (GET) no escriben: no se copia el estado completo.
    const snapshot = input.method.toUpperCase() === "GET" ? null : structuredClone(state);
    let outcome: PracticeOutcome;
    try {
        outcome = routePracticeRequestDetailed(request, state);
    } catch (error) {
        if (snapshot !== null) {
            restoreState(session, snapshot);
        }
        throw error;
    }
    // Sin cambios no hay guardado.
    if (!outcome.wrote) {
        return outcome.result;
    }
    if (snapshot === null) {
        // Una lectura que escribe no debería existir; sin copia para revertir se descarta el estado y se falla cerrado.
        session.state = null;
        throw new PracticeRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE);
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
    // La red serializa el cuerpo como JSON: se normaliza igual (una clave con valor undefined desaparece).
    let body: unknown;
    try {
        const serialized = input.body === undefined ? undefined : JSON.stringify(input.body);
        body = serialized === undefined ? undefined : JSON.parse(serialized);
    } catch {
        throw new PracticeRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE);
    }
    const session = await sessionFor(input.userId);
    return runExclusive(session, () => executeRequest(session, { ...input, body }));
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
        // Un reinicio manual no cuenta como reinicio por versión: el aviso no debe aparecer.
        session.wasReset = false;
        revokeSessionUrls(session);
        try {
            await session.storage.clear();
        } catch {
            degradeToMemory(session);
        }
    });
};

// Estado de la práctica en este navegador. Carga el estado en la cola para que wasReset refleje el arranque
// aunque todavía no haya habido peticiones.
export const getPracticeStatus = async (
    userId: string,
): Promise<{ persistent: boolean; wasReset: boolean }> => {
    const session = await sessionFor(userId);
    await runExclusive(session, () => stateFor(session, userId));
    return {
        persistent: session.persistent,
        wasReset: session.wasReset && !acknowledgedResets.has(userId),
    };
};

// Cierra el aviso de reinicio del usuario. Es síncrono y no necesita que la sesión esté abierta.
export const acknowledgePracticeReset = (userId: string): void => {
    acknowledgedResets.add(userId);
};

// Tope de espera al pedir borrar la base: si el navegador no responde, no se bloquea el cierre de sesión.
const DELETE_DATABASE_TIMEOUT_MS = 2000;

// Pide borrar la base IndexedDB del usuario. Resuelve al terminar, al bloquearse (la base se borra al cerrarse
// la última conexión) o al pasar el tope. Nunca rechaza.
const deleteBrowserDatabase = (userId: string): Promise<void> =>
    new Promise<void>((resolve) => {
        const factory: IDBFactory | undefined = globalThis.indexedDB;
        if (!factory) {
            resolve();
            return;
        }
        const timer = setTimeout(() => resolve(), DELETE_DATABASE_TIMEOUT_MS);
        const done = (): void => {
            clearTimeout(timer);
            resolve();
        };
        try {
            const request = factory.deleteDatabase(practiceDbName(userId));
            request.onsuccess = done;
            request.onerror = done;
            request.onblocked = done;
        } catch {
            done();
        }
    });

// Borra todo lo que este navegador guarda de la práctica del usuario al cerrar sesión: sus archivos pendientes,
// las URL de descarga, el estado memorizado y la base IndexedDB. Olvida la sesión para que nada más escriba en la
// base borrada. Es de mejor esfuerzo y nunca rechaza: un fallo no debe impedir cerrar sesión.
export const deletePracticeData = async (userId: string): Promise<void> => {
    try {
        const existing = sessions.get(userId);
        if (existing === undefined) {
            await deleteBrowserDatabase(userId);
            return;
        }
        const session = await existing;
        await runExclusive(session, async () => {
            try {
                const state = await stateFor(session, userId);
                for (const upload of state.uploads) {
                    takePracticeFile(upload.id);
                }
            } catch {
                // Sin estado legible no se conocen los tickets: la base se borra igualmente.
            }
            revokeSessionUrls(session);
            try {
                await session.storage.clear();
            } catch {
                // Si la conexión está rota, la petición de borrado de la base la cierra o queda pendiente.
            }
            session.state = null;
            session.wasReset = false;
            // Una petición que aún tenga esta sesión escribe solo en memoria, nunca en la base que se borra.
            degradeToMemory(session);
            sessions.delete(userId);
            await deleteBrowserDatabase(userId);
        });
    } catch {
        // Mejor esfuerzo: nunca rechaza.
    }
};
