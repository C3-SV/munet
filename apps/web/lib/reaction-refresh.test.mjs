import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDebouncedRefresh } from "./reaction-refresh.ts";

const feedPath = new URL("../app/(main)/feed/[muro]/page.tsx", import.meta.url);

test("las reacciones del feed no se consultan por intervalo fijo", async () => {
    const source = await readFile(feedPath, "utf8");

    assert.doesNotMatch(source, /window\.setInterval\(\(\) => \{\s*if \(document\.visibilityState === "visible"\) void refreshReactions\(\);\s*\}, 10000\)/);
});

test("reconcilia cada 120 s conectado y conserva 30 s solo como respaldo visible", async () => {
    const source = await readFile(feedPath, "utf8");

    assert.match(source, /const fallbackIntervalMs = 30000/);
    assert.match(source, /const realtimeReconcileIntervalMs = 120000/);
    assert.match(source, /if \(!realtimeReady \|\| reconcileTimer !== null \|\| document\.visibilityState !== "visible"\) return/);
    assert.match(source, /if \(realtimeReady\) \{\s+stopFallback\(\);\s+startReconciliation\(\);/);
});

test("agrupa invalidaciones consecutivas en una sola recarga", async () => {
    let calls = 0;
    const refresh = createDebouncedRefresh(async () => { calls += 1; }, 5);

    refresh.schedule();
    refresh.schedule();
    refresh.schedule();
    await new Promise((resolve) => setTimeout(resolve, 15));

    refresh.cancel();
    assert.equal(calls, 1);
});

test("cancelar impide ejecutar las invalidaciones que siguen pendientes", async () => {
    let calls = 0;
    const refresh = createDebouncedRefresh(async () => { calls += 1; }, 5);

    refresh.schedule();
    refresh.cancel();
    await new Promise((resolve) => setTimeout(resolve, 15));

    assert.equal(calls, 0);
});

test("serializa las recargas y conserva un solo refresco pendiente", async () => {
    let releaseFirst;
    let calls = 0;
    const refresh = createDebouncedRefresh(async () => {
        calls += 1;
        if (calls === 1) await new Promise((resolve) => { releaseFirst = resolve; });
    }, 5);

    refresh.schedule();
    await new Promise((resolve) => setTimeout(resolve, 10));
    for (let i = 0; i < 10; i += 1) refresh.schedule();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(calls, 1);

    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 15));
    refresh.cancel();
    assert.equal(calls, 2);
});
