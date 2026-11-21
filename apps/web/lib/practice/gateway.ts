import { openPracticeStorage } from "./indexeddb-storage.ts";
import {
    PRACTICE_UNAVAILABLE_MESSAGE,
    PracticeRequestError,
    routePracticeRequest,
} from "./router.ts";
import type { PracticeState } from "./state.ts";
import { createMemoryStorage, loadOrInitState, type PracticeStorage } from "./storage.ts";

// Pasarela del modo práctica: por usuario guarda un almacén y el estado cargado, y resuelve las
// peticiones con el enrutador local. No usa la red en ningún caso.

export type PracticeStorageFactory = (userId: string) => Promise<PracticeStorage>;

type PracticeSession = {
    storage: PracticeStorage;
    persistent: boolean;
    // Estado cargado o creado para el usuario; null después de reiniciar la práctica.
    state: Promise<PracticeState> | null;
};

// Fábrica inyectada solo para pruebas. Con ella el almacén cuenta como persistente hasta que falle.
let injectedFactory: PracticeStorageFactory | null = null;
const sessions = new Map<string, Promise<PracticeSession>>();

// Sustituye el almacén por una fábrica (pruebas) o lo restaura con null. Descarta las sesiones abiertas.
export const setPracticeStorageFactory = (factory: PracticeStorageFactory | null): void => {
    injectedFactory = factory;
    sessions.clear();
};

const memorySession = (): PracticeSession => ({
    storage: createMemoryStorage(),
    persistent: false,
    state: null,
});

// Abre el almacén del usuario. Cualquier fallo (incluido leer indexedDB) cae a memoria sin propagar el error.
const openSession = async (userId: string): Promise<PracticeSession> => {
    try {
        if (injectedFactory) {
            return { storage: await injectedFactory(userId), persistent: true, state: null };
        }
        const { storage, persistent } = await openPracticeStorage(userId, globalThis.indexedDB);
        return { storage, persistent, state: null };
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

export const runPracticeRequest = async (input: {
    userId: string;
    method: string;
    path: string;
    body?: unknown;
}): Promise<unknown> => {
    // Entradas que no son texto no tienen ruta válida: se falla cerrado con 501, sin TypeError.
    if (typeof input.method !== "string" || typeof input.path !== "string") {
        throw new PracticeRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE);
    }
    const session = await sessionFor(input.userId);
    const state = await stateFor(session, input.userId);
    return routePracticeRequest({ method: input.method, path: input.path, body: input.body }, state);
};

// Borra el almacén del usuario y olvida el estado memorizado. Si el borrado falla, la sesión pasa
// a memoria vacía para no reutilizar datos anteriores; nunca rechaza.
export const resetPractice = async (userId: string): Promise<void> => {
    const session = await sessionFor(userId);
    session.state = null;
    try {
        await session.storage.clear();
    } catch {
        degradeToMemory(session);
    }
};

export const getPracticeStatus = async (userId: string): Promise<{ persistent: boolean }> => {
    const session = await sessionFor(userId);
    return { persistent: session.persistent };
};
