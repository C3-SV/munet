import test from "node:test";
import assert from "node:assert/strict";

import { createAttachmentPreviewUrlLoader } from "./attachment-preview-urls.ts";

const context = { token: "sesion-a", eventId: "evento-a" };
const item = (id) => ({ postId: `post-${id}`, attachmentId: `adjunto-${id}` });
const delay = () => new Promise((resolve) => setTimeout(resolve, 10));

test("agrupa previews simultáneas y comparte una firma en curso por adjunto", async () => {
    const calls = [];
    const loader = createAttachmentPreviewUrlLoader({
        requestBatch: async (_context, items) => {
            calls.push(items);
            return items.map((_value, index) => ({ index, url: `https://r2.test/${index}`, expiresAt: new Date(Date.now() + 60_000).toISOString() }));
        },
    });

    const first = loader(context, item(1));
    const duplicate = loader(context, item(1));
    const second = loader(context, item(2));
    await delay();

    assert.deepEqual(await Promise.all([first, duplicate, second]), ["https://r2.test/0", "https://r2.test/0", "https://r2.test/1"]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].length, 2);
});

test("divide lotes de más de 40 y no mezcla sesiones ni eventos", async () => {
    const calls = [];
    const loader = createAttachmentPreviewUrlLoader({
        requestBatch: async (ctx, items) => {
            calls.push([ctx, items.length]);
            return items.map((_value, index) => ({ index, url: "https://r2.test/image", expiresAt: new Date(Date.now() + 60_000).toISOString() }));
        },
    });

    const requests = Array.from({ length: 41 }, (_, index) => loader(context, item(index)));
    const other = loader({ ...context, token: "sesion-b" }, item(1));
    await delay();
    await Promise.all([...requests, other]);

    assert.deepEqual(calls.map(([, items]) => items), [40, 1, 1]);
    assert.equal(new Set(calls.map(([ctx]) => ctx.token)).size, 2);
});

test("reutiliza URL solo antes del margen de expiración y firma otra vez después", async () => {
    let now = 1_000_000;
    let calls = 0;
    const loader = createAttachmentPreviewUrlLoader({
        now: () => now,
        requestBatch: async () => {
            calls += 1;
            return [{ index: 0, url: `https://r2.test/${calls}`, expiresAt: new Date(now + 60_000).toISOString() }];
        },
    });

    assert.equal(await loader(context, item(1)), "https://r2.test/1");
    assert.equal(await loader(context, item(1)), "https://r2.test/1");
    assert.equal(await loader(context, item(1), true), "https://r2.test/2");
    now += 56_000;
    assert.equal(await loader(context, item(1)), "https://r2.test/3");
    assert.equal(calls, 3);
});

test("resultados parciales fallan solo para el elemento inaccesible", async () => {
    const loader = createAttachmentPreviewUrlLoader({
        requestBatch: async () => [
            { index: 0, url: "https://r2.test/ok", expiresAt: new Date(Date.now() + 60_000).toISOString() },
            { index: 1, error: "No se pudo cargar el adjunto." },
        ],
    });
    const results = await Promise.allSettled([loader(context, item(1)), loader(context, item(2))]);
    await delay();

    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[1].status, "rejected");
});

test("solo usa la ruta individual como fallback ante 404 de rollout", async () => {
    let singles = 0;
    const notFound = Object.assign(new Error("route missing"), { status: 404 });
    const makeLoader = (error) => createAttachmentPreviewUrlLoader({
        requestBatch: async () => { throw error; },
        requestSingle: async () => { singles += 1; return "https://r2.test/single"; },
    });

    assert.equal(await makeLoader(notFound)(context, item(1)), "https://r2.test/single");
    assert.equal(singles, 1);

    const systemic = makeLoader(Object.assign(new Error("server error"), { status: 500 }));
    await assert.rejects(systemic(context, item(2)), /server error/);
    assert.equal(singles, 1);
});
