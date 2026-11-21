import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { buildPracticeWalls } from "./catalog.ts";
import {
    getPracticeStatus,
    resetPractice,
    runPracticeRequest,
    setPracticeStorageFactory,
} from "./gateway.ts";
import { PRACTICE_UNAVAILABLE_MESSAGE, PracticeRequestError } from "./router.ts";
import { personaFor } from "./state.ts";
import { createMemoryStorage } from "./storage.ts";

const run = (userId, method, path) => runPracticeRequest({ userId, method, path });

const isRequestError = (status, message) => (error) =>
    error instanceof PracticeRequestError && error.status === status && error.message === message;

// Fábrica con un almacén en memoria por usuario; las referencias quedan en `stores` para inspeccionarlas.
const perUserStores = () => {
    const stores = new Map();
    const factory = async (userId) => {
        const storage = createMemoryStorage();
        stores.set(userId, storage);
        return storage;
    };
    return { stores, factory };
};

const originalFetch = globalThis.fetch;
let fetchCalls = 0;

beforeEach(() => {
    fetchCalls = 0;
    // Ninguna petición de práctica puede llegar a la red.
    globalThis.fetch = () => {
        fetchCalls += 1;
        throw new Error("fetch prohibido");
    };
});

afterEach(() => {
    setPracticeStorageFactory(null);
    globalThis.fetch = originalFetch;
});

test("walls: devuelve los seis muros de la persona del usuario", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const response = await run("u1", "GET", "/events/practice-local/walls");
    assert.equal(response.walls.length, 6);
    assert.deepEqual(response.walls, buildPracticeWalls(personaFor("u1").committeeId));
});

test("camino no simulado: rechaza con PracticeRequestError 501", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    await assert.rejects(
        () => run("u1", "POST", "/posts"),
        isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
    );
});

test("dos usuarios no comparten estado: persona y almacén propios", async () => {
    const { stores, factory } = perUserStores();
    setPracticeStorageFactory(factory);
    const first = await run("u1", "GET", "/profiles/me");
    const second = await run("u2", "GET", "/profiles/me");
    assert.notEqual(first.profile.profile.displayName, second.profile.profile.displayName);
    assert.equal(first.profile.profile.displayName, personaFor("u1").displayName);
    assert.equal(second.profile.profile.displayName, personaFor("u2").displayName);
    assert.equal((await stores.get("u1").load()).userId, "u1");
    assert.equal((await stores.get("u2").load()).userId, "u2");
});

test("resetPractice vacia el almacén del usuario y no toca el de otro", async () => {
    const { stores, factory } = perUserStores();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    await run("u2", "GET", "/profiles/me");
    assert.notEqual(await stores.get("u1").load(), null);

    await resetPractice("u1");
    assert.equal(await stores.get("u1").load(), null);
    assert.notEqual(await stores.get("u2").load(), null);

    // La siguiente petición vuelve a sembrar el estado de u1.
    const { profile } = await run("u1", "GET", "/profiles/me");
    assert.equal(profile.participantCode, "PRACTICA");
    assert.equal((await stores.get("u1").load()).userId, "u1");
});

test("ninguna petición de práctica llama a fetch", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    await run("u1", "GET", "/events/practice-local/walls");
    await run("u1", "GET", "/profiles/me");
    await run("u1", "GET", "/dm/conversations");
    await assert.rejects(() => run("u1", "POST", "/posts"), isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE));
    await resetPractice("u1");
    assert.equal(fetchCalls, 0);
});

test("método o ruta que no son texto fallan cerrados con 501, no con TypeError", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    await assert.rejects(
        () => runPracticeRequest({ userId: "u1", method: undefined, path: "/profiles/me" }),
        isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
    );
    await assert.rejects(
        () => runPracticeRequest({ userId: "u1", method: "GET", path: 42 }),
        isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
    );
});

test("si save rechaza, la práctica sigue en memoria y el estado lo refleja", async () => {
    const failing = {
        ...createMemoryStorage(),
        save: async () => {
            throw new Error("cuota excedida");
        },
    };
    setPracticeStorageFactory(async () => failing);
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: true });

    const { profile } = await run("u1", "GET", "/profiles/me");
    assert.equal(profile.participantCode, "PRACTICA");
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: false });
});

test("si clear rechaza, resetPractice resuelve y la práctica sigue en un estado limpio", async () => {
    const failing = {
        ...createMemoryStorage(),
        clear: async () => {
            throw new Error("conexión cerrada");
        },
    };
    setPracticeStorageFactory(async () => failing);
    await run("u1", "GET", "/profiles/me");

    await assert.doesNotReject(() => resetPractice("u1"));
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: false });

    const { profile } = await run("u1", "GET", "/profiles/me");
    assert.equal(profile.participantCode, "PRACTICA");
});
