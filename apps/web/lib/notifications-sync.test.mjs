import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const load = (file) => {
    const moduleStub = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, { module: moduleStub, exports: moduleStub.exports });
    return moduleStub.exports;
};

const { createNotificationRefresh, notificationRequestKey } = load(fileURLToPath(new URL("./notifications-sync.ts", import.meta.url)));

const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
};

test("una sola solicitud simultánea agrupa disparos durante la lectura en un refresh posterior", async () => {
    const pending = deferred();
    const summaries = [{ unread: 1 }, { unread: 2 }];
    const applied = [];
    let calls = 0;
    let key = "session-1";
    const refresh = createNotificationRefresh({
        getSummary: () => (++calls === 1 ? pending.promise : Promise.resolve(summaries[1])),
        getKey: () => key,
        setSummary: (value) => applied.push(value),
    });

    const first = refresh();
    await refresh();
    await refresh();
    pending.resolve(summaries[0]);
    await first;

    assert.equal(calls, 2);
    assert.deepEqual(applied, summaries);
});

test("al rotar sesión una respuesta tardía se descarta y el refresh en cola usa la sesión nueva", async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    const applied = [];
    let key = "session-1";
    let calls = 0;
    const refresh = createNotificationRefresh({
        getSummary: () => (++calls === 1 ? oldRequest.promise : newRequest.promise),
        getKey: () => key,
        setSummary: (value) => applied.push(value),
    });

    const request = refresh();
    key = "session-2";
    await refresh();
    oldRequest.resolve({ unread: 7 });
    await Promise.resolve();
    newRequest.resolve({ unread: 1 });
    await request;

    assert.equal(calls, 2);
    assert.deepEqual(applied, [{ unread: 1 }]);
});

test("al entrar a práctica una solicitud en cola no inicia fetch y descarta la respuesta anterior", async () => {
    const pending = deferred();
    const applied = [];
    let enabled = true;
    let eventId = "event-1";
    let calls = 0;
    const refresh = createNotificationRefresh({
        getSummary: () => (++calls, pending.promise),
        getKey: () => notificationRequestKey("token", eventId, enabled),
        setSummary: (value) => applied.push(value),
    });

    const first = refresh();
    await refresh();
    eventId = "practice-local";
    enabled = false;
    pending.resolve({ unread: 7 });
    await first;

    assert.equal(calls, 1);
    assert.deepEqual(applied, []);
});

test("un fallo queda listo para el siguiente ciclo de sondeo", async () => {
    const applied = [];
    let calls = 0;
    const refresh = createNotificationRefresh({
        getKey: () => "session-1",
        getSummary: async () => {
            calls += 1;
            if (calls === 1) throw new Error("offline");
            return { unread: 1 };
        },
        setSummary: (value) => applied.push(value),
    });

    await refresh();
    await refresh();

    assert.equal(calls, 2);
    assert.deepEqual(applied, [{ unread: 1 }]);
});
