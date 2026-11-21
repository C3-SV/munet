import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { PRACTICE_STATE_VERSION } from "./constants.ts";
import { createInitialState } from "./state.ts";
import { createMemoryStorage, loadOrInitState } from "./storage.ts";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-06-01T00:00:00.000Z");

test("almacen vacio: devuelve el estado inicial sin reinicio y lo deja guardado", async () => {
    const storage = createMemoryStorage();
    const result = await loadOrInitState(storage, "user-1", NOW);
    assert.equal(result.wasReset, false);
    assert.deepEqual(result.state, createInitialState("user-1", NOW));
    assert.deepEqual(await storage.load(), createInitialState("user-1", NOW));
});

test("una segunda carga devuelve el mismo estado guardado sin cambiar createdAt", async () => {
    const storage = createMemoryStorage();
    const first = await loadOrInitState(storage, "user-1", NOW);
    const second = await loadOrInitState(storage, "user-1", LATER);
    assert.equal(second.wasReset, false);
    assert.deepEqual(second.state, first.state);
    assert.equal(second.state.createdAt, NOW.toISOString());
});

test("una version distinta reinicia el estado y llama a clear", async () => {
    const storage = createMemoryStorage();
    await storage.save({ ...createInitialState("user-1", NOW), version: PRACTICE_STATE_VERSION + 1 });
    const clear = mock.method(storage, "clear");
    const result = await loadOrInitState(storage, "user-1", LATER);
    assert.equal(result.wasReset, true);
    assert.equal(clear.mock.callCount(), 1);
    assert.equal(result.state.version, PRACTICE_STATE_VERSION);
    assert.equal(result.state.createdAt, LATER.toISOString());
    assert.deepEqual(await storage.load(), createInitialState("user-1", LATER));
});

test("un userId distinto en el almacen reinicia el estado", async () => {
    const storage = createMemoryStorage();
    await storage.save(createInitialState("user-2", NOW));
    const result = await loadOrInitState(storage, "user-1", LATER);
    assert.equal(result.wasReset, true);
    assert.equal(result.state.userId, "user-1");
    assert.deepEqual(await storage.load(), createInitialState("user-1", LATER));
});

test("valores basura o sin forma valida reinician el estado", async () => {
    const withoutPersona = { ...createInitialState("user-1", NOW) };
    delete withoutPersona.persona;
    const invalidValues = ["basura", {}, withoutPersona];
    for (const raw of invalidValues) {
        const storage = { ...createMemoryStorage(), load: async () => raw };
        const clear = mock.method(storage, "clear");
        const result = await loadOrInitState(storage, "user-1", LATER);
        assert.equal(result.wasReset, true, `valor: ${JSON.stringify(raw)}`);
        assert.equal(clear.mock.callCount(), 1, `valor: ${JSON.stringify(raw)}`);
    }
});

test("si load lanza, reinicia el estado sin propagar el error", async () => {
    const storage = {
        ...createMemoryStorage(),
        load: async () => {
            throw new Error("IndexedDB no disponible");
        },
    };
    const clear = mock.method(storage, "clear");
    const result = await loadOrInitState(storage, "user-1", NOW);
    assert.equal(result.wasReset, true);
    assert.deepEqual(result.state, createInitialState("user-1", NOW));
    assert.equal(clear.mock.callCount(), 1);
});

test("dos almacenes con usuarios distintos no comparten estado ni blobs", async () => {
    const storageA = createMemoryStorage();
    const storageB = createMemoryStorage();
    const resultA = await loadOrInitState(storageA, "user-a", NOW);
    const resultB = await loadOrInitState(storageB, "user-b", NOW);
    assert.equal(resultA.state.userId, "user-a");
    assert.equal(resultB.state.userId, "user-b");
    assert.equal(resultB.wasReset, false);
    assert.equal((await storageA.load()).userId, "user-a");
    assert.equal((await storageB.load()).userId, "user-b");

    await storageA.putBlob("foto", new Blob(["a"]));
    assert.equal(await storageB.getBlob("foto"), null);
});

test("putBlob, getBlob y deleteBlob guardan, devuelven y borran", async () => {
    const storage = createMemoryStorage();
    await storage.putBlob("foto-1", new Blob(["hola"], { type: "text/plain" }));
    const stored = await storage.getBlob("foto-1");
    assert.ok(stored instanceof Blob);
    assert.equal(stored.type, "text/plain");
    assert.equal(await stored.text(), "hola");
    await storage.deleteBlob("foto-1");
    assert.equal(await storage.getBlob("foto-1"), null);
});

test("getBlob de un id desconocido da null y deleteBlob de un id desconocido no falla", async () => {
    const storage = createMemoryStorage();
    assert.equal(await storage.getBlob("no-existe"), null);
    await storage.deleteBlob("no-existe");
});

test("clear vacia el estado y los blobs", async () => {
    const storage = createMemoryStorage();
    await loadOrInitState(storage, "user-1", NOW);
    await storage.putBlob("foto-1", new Blob(["hola"]));
    await storage.clear();
    assert.equal(await storage.load(), null);
    assert.equal(await storage.getBlob("foto-1"), null);
});
