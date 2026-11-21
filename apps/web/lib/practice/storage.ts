import { PRACTICE_STATE_VERSION } from "./constants.ts";
import type { PracticeState } from "./state.ts";
import { createInitialState } from "./state.ts";

// Contrato del almacén local del modo práctica. Las implementaciones persistentes (IndexedDB)
// llegan en una tarea posterior; aquí solo está la versión en memoria.
export interface PracticeStorage {
    load(): Promise<unknown | null>;
    save(state: PracticeState): Promise<void>;
    putBlob(id: string, blob: Blob): Promise<void>;
    getBlob(id: string): Promise<Blob | null>;
    deleteBlob(id: string): Promise<void>;
    clear(): Promise<void>;
}

export type LoadResult = { state: PracticeState; wasReset: boolean };

// Almacén en memoria: el estado y los blobs viven solo mientras exista el objeto devuelto. El estado se copia
// al guardar y al leer, como hace IndexedDB; así cambiar el objeto en memoria no altera lo guardado.
export const createMemoryStorage = (): PracticeStorage => {
    let savedState: unknown | null = null;
    const blobs = new Map<string, Blob>();
    return {
        load: async () => (savedState === null ? null : structuredClone(savedState)),
        save: async (state) => {
            savedState = structuredClone(state);
        },
        putBlob: async (id, blob) => {
            blobs.set(id, blob);
        },
        getBlob: async (id) => blobs.get(id) ?? null,
        deleteBlob: async (id) => {
            blobs.delete(id);
        },
        clear: async () => {
            savedState = null;
            blobs.clear();
        },
    };
};

const isPlainObject = (value: unknown): boolean =>
    typeof value === "object" && value !== null && !Array.isArray(value);

// Foto propia: null o una imagen data URI de los tipos que admite la subida. Cualquier otra cosa (incluido
// undefined o un esquema http) invalida el estado guardado.
const AVATAR_PREFIXES: readonly string[] = [
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/webp;base64,",
];
const isValidAvatar = (avatar: unknown): boolean =>
    avatar === null ||
    (typeof avatar === "string" && AVATAR_PREFIXES.some((prefix) => avatar.startsWith(prefix)));

// Solo se reutiliza un estado si coincide la versión, el usuario y la forma completa de la versión 2.
const isStoredState = (value: unknown, userId: string): value is PracticeState => {
    if (!isPlainObject(value)) {
        return false;
    }
    const candidate = value as Partial<PracticeState>;
    const profile = candidate.profile as Record<string, unknown> | undefined;
    return (
        candidate.version === PRACTICE_STATE_VERSION &&
        candidate.userId === userId &&
        isPlainObject(candidate.persona) &&
        Number.isInteger(candidate.seq) &&
        Array.isArray(candidate.people) &&
        Array.isArray(candidate.posts) &&
        Array.isArray(candidate.comments) &&
        Array.isArray(candidate.conversations) &&
        Array.isArray(candidate.messages) &&
        Array.isArray(candidate.uploads) &&
        isPlainObject(profile) &&
        isValidAvatar(profile?.avatar) &&
        isPlainObject(candidate.replyCounts)
    );
};

const resetState = async (
    storage: PracticeStorage,
    userId: string,
    now: Date,
): Promise<LoadResult> => {
    await storage.clear();
    const state = createInitialState(userId, now);
    await storage.save(state);
    return { state, wasReset: true };
};

// Carga el estado guardado o crea uno nuevo. Cualquier dato que no sea válido para este
// usuario y versión (incluido un error al leer) se descarta y se reemplaza.
export const loadOrInitState = async (
    storage: PracticeStorage,
    userId: string,
    now: Date,
): Promise<LoadResult> => {
    let stored: unknown;
    try {
        stored = await storage.load();
    } catch {
        return resetState(storage, userId, now);
    }

    if (stored === null) {
        const state = createInitialState(userId, now);
        await storage.save(state);
        return { state, wasReset: false };
    }

    if (isStoredState(stored, userId)) {
        return { state: stored, wasReset: false };
    }

    return resetState(storage, userId, now);
};
