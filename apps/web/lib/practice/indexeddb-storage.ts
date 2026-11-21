import { practiceDbName } from "./constants.ts";
import type { PracticeStorage } from "./storage.ts";
import { createMemoryStorage } from "./storage.ts";

// Almacén persistente del modo práctica: una base IndexedDB por usuario con dos almacenes.
// Si el navegador no puede abrir la base, openPracticeStorage usa el respaldo en memoria.
export type StorageChoice = { storage: PracticeStorage; persistent: boolean };

const DB_VERSION = 1;
const STATE_STORE = "state";
const BLOB_STORE = "blobs";
const STATE_KEY = "state";

// Abre la base del usuario y crea los almacenes en la primera versión. Cualquier fallo
// (factoría ausente, excepción síncrona o evento onerror) rechaza la promesa.
const openDatabase = (factory: IDBFactory, userId: string): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const request = factory.open(practiceDbName(userId), DB_VERSION);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STATE_STORE);
            request.result.createObjectStore(BLOB_STORE);
        };
        request.onsuccess = () => {
            const db = request.result;
            // Si otra pestaña necesita actualizar la base, se cierra la conexión para no bloquearla.
            db.onversionchange = () => db.close();
            resolve(db);
        };
        request.onerror = () => reject(request.error);
    });

// Espera el resultado de una lectura.
const readRequest = <T>(request: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

// Ejecuta escrituras y resuelve solo cuando la transacción se confirma.
const writeTransaction = (
    db: IDBDatabase,
    storeNames: string | string[],
    write: (transaction: IDBTransaction) => void,
): Promise<void> =>
    new Promise((resolve, reject) => {
        const transaction = db.transaction(storeNames, "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
        write(transaction);
    });

// Almacén sobre una conexión que se abre una sola vez y se reutiliza en cada operación.
// Un fallo al abrir queda memorizado y cada operación lo rechaza.
const createDatabaseStorage = (openConnection: () => Promise<IDBDatabase>): PracticeStorage => {
    let connection: Promise<IDBDatabase> | undefined;
    const database = (): Promise<IDBDatabase> => {
        connection ??= openConnection();
        return connection;
    };
    return {
        // Una clave ausente se devuelve como null, nunca como undefined.
        load: async () => {
            const transaction = (await database()).transaction(STATE_STORE, "readonly");
            const value = await readRequest<unknown>(
                transaction.objectStore(STATE_STORE).get(STATE_KEY),
            );
            return value ?? null;
        },
        save: async (state) => {
            await writeTransaction(await database(), STATE_STORE, (transaction) => {
                transaction.objectStore(STATE_STORE).put(state, STATE_KEY);
            });
        },
        putBlob: async (id, blob) => {
            await writeTransaction(await database(), BLOB_STORE, (transaction) => {
                transaction.objectStore(BLOB_STORE).put(blob, id);
            });
        },
        getBlob: async (id) => {
            const transaction = (await database()).transaction(BLOB_STORE, "readonly");
            const value = await readRequest<Blob | undefined>(
                transaction.objectStore(BLOB_STORE).get(id),
            );
            return value ?? null;
        },
        deleteBlob: async (id) => {
            await writeTransaction(await database(), BLOB_STORE, (transaction) => {
                transaction.objectStore(BLOB_STORE).delete(id);
            });
        },
        clear: async () => {
            await writeTransaction(await database(), [STATE_STORE, BLOB_STORE], (transaction) => {
                transaction.objectStore(STATE_STORE).clear();
                transaction.objectStore(BLOB_STORE).clear();
            });
        },
    };
};

// Almacén de IndexedDB del usuario sobre el indexedDB global. La base se abre en la primera operación.
export const createIndexedDbStorage = (userId: string): PracticeStorage =>
    createDatabaseStorage(() => openDatabase(indexedDB, userId));

// Abre la base con la factoría indicada para comprobar que funciona antes de usarla. Si no hay
// factoría o la apertura falla, devuelve el respaldo en memoria sin propagar el error.
export const openPracticeStorage = async (
    userId: string,
    indexedDbFactory?: IDBFactory | undefined,
): Promise<StorageChoice> => {
    if (!indexedDbFactory) {
        return { storage: createMemoryStorage(), persistent: false };
    }
    try {
        const db = await openDatabase(indexedDbFactory, userId);
        return { storage: createDatabaseStorage(() => Promise.resolve(db)), persistent: true };
    } catch {
        return { storage: createMemoryStorage(), persistent: false };
    }
};
