import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "./state.ts";
import { openPracticeStorage } from "./indexeddb-storage.ts";

const NOW = new Date("2026-01-01T00:00:00.000Z");

test("sin IDBFactory usa el respaldo en memoria y guarda y devuelve un estado", async () => {
    const { storage, persistent } = await openPracticeStorage("u1", undefined);
    assert.equal(persistent, false);
    const state = createInitialState("u1", NOW);
    await storage.save(state);
    assert.deepEqual(await storage.load(), state);
});

test("si open lanza, usa el respaldo en memoria sin propagar el error", async () => {
    const factory = {
        open() {
            throw new Error("SecurityError");
        },
    };
    const { storage, persistent } = await openPracticeStorage("u1", factory);
    assert.equal(persistent, false);
    assert.equal(await storage.load(), null);
});

test("si open dispara onerror, usa el respaldo en memoria sin propagar el error", async () => {
    const factory = {
        open() {
            const request = {};
            queueMicrotask(() => request.onerror?.({ target: request }));
            return request;
        },
    };
    const { storage, persistent } = await openPracticeStorage("u1", factory);
    assert.equal(persistent, false);
    assert.equal(await storage.load(), null);
});

test("si open abre la base, devuelve persistent true", async () => {
    const factory = {
        open() {
            const request = { result: {} };
            queueMicrotask(() => request.onsuccess?.({ target: request }));
            return request;
        },
    };
    const { persistent } = await openPracticeStorage("u1", factory);
    assert.equal(persistent, true);
});

test("una apertura colgada cae a memoria al cumplirse el tiempo de espera, sin dejar temporizadores", async () => {
    // La fábrica nunca llama a onsuccess ni a onerror.
    const factory = {
        open() {
            return {};
        },
    };
    const { storage, persistent } = await openPracticeStorage("u1", factory, 20);
    assert.equal(persistent, false);
    const state = createInitialState("u1", NOW);
    await storage.save(state);
    assert.deepEqual(await storage.load(), state);
});

test("una apertura que llega después del tiempo de espera se cierra sin usarla", async () => {
    let request;
    const factory = {
        open() {
            request = {};
            return request;
        },
    };
    const { persistent } = await openPracticeStorage("u1", factory, 5);
    assert.equal(persistent, false);

    let closed = 0;
    request.result = {
        close() {
            closed += 1;
        },
    };
    request.onsuccess({ target: request });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(closed, 1);
});
