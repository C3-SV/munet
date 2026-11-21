import assert from "node:assert/strict";
import test from "node:test";
import { AttachmentUploadError, publishWithAttachment, putFileToStorage } from "./attachment-upload.ts";

const ticket = {
    id: "up-1",
    url: "https://r2.test/put?sig=1",
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
};

test("sube el archivo con la URL y las cabeceras firmadas, sin credenciales", async () => {
    const calls = [];
    await putFileToStorage(ticket, "ARCHIVO", async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200 };
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, ticket.url);
    assert.equal(calls[0].init.method, "PUT");
    assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/pdf" });
    assert.equal(calls[0].init.body, "ARCHIVO");
    assert.ok(!("Authorization" in calls[0].init.headers));
});

test("un corte de red al subir lanza un error de subida entendible", async () => {
    await assert.rejects(
        putFileToStorage(ticket, "x", async () => {
            throw new TypeError("Failed to fetch");
        }),
        (error) => error instanceof AttachmentUploadError && /conexión/.test(error.message),
    );
});

test("una respuesta 403 se explica como vencida; otras fallas son genéricas", async () => {
    await assert.rejects(
        putFileToStorage(ticket, "x", async () => ({ ok: false, status: 403 })),
        /venció/,
    );
    await assert.rejects(
        putFileToStorage(ticket, "x", async () => ({ ok: false, status: 500 })),
        /No se pudo subir/,
    );
});

const base = (overrides = {}) => {
    const log = [];
    return {
        log,
        params: {
            initUpload: async () => {
                log.push("init");
                return ticket;
            },
            upload: async () => {
                log.push("upload");
            },
            createPost: async (id) => {
                log.push(`create:${id}`);
                return { id: "post-1" };
            },
            isRetryable: () => false,
            retryDelayMs: 0,
            ...overrides,
        },
    };
};

test("orden: inicia, sube y crea el post con el id de la subida", async () => {
    const { log, params } = base();
    const post = await publishWithAttachment(params);

    assert.deepEqual(post, { id: "post-1" });
    assert.deepEqual(log, ["init", "upload", "create:up-1"]);
});

test("si falla el inicio no se sube ni se crea nada", async () => {
    const { log, params } = base({
        initUpload: async () => {
            log.push("init");
            throw new Error("429");
        },
    });
    await assert.rejects(publishWithAttachment(params), /429/);
    assert.deepEqual(log, ["init"]);
});

test("si falla la subida no se crea el post", async () => {
    const { log, params } = base({
        upload: async () => {
            log.push("upload");
            throw new AttachmentUploadError("falló");
        },
    });
    await assert.rejects(publishWithAttachment(params), /falló/);
    assert.deepEqual(log, ["init", "upload"]);
});

test("un corte de red al crear el post se reintenta una vez con el mismo id", async () => {
    let attempts = 0;
    const { log, params } = base({
        createPost: async (id) => {
            attempts += 1;
            log.push(`create:${id}`);
            if (attempts === 1) throw new TypeError("network");
            return { id: "post-1" };
        },
        isRetryable: (error) => error instanceof TypeError,
    });

    assert.deepEqual(await publishWithAttachment(params), { id: "post-1" });
    assert.deepEqual(log, ["init", "upload", "create:up-1", "create:up-1"]);
});

test("el reintento es único: un segundo fallo se propaga", async () => {
    let attempts = 0;
    const { params } = base({
        createPost: async () => {
            attempts += 1;
            throw new TypeError("network");
        },
        isRetryable: () => true,
    });

    await assert.rejects(publishWithAttachment(params), /network/);
    assert.equal(attempts, 2);
});

test("un error de la API (no de red) no se reintenta", async () => {
    let attempts = 0;
    const { params } = base({
        createPost: async () => {
            attempts += 1;
            throw new Error("400 contenido inválido");
        },
        isRetryable: (error) => error instanceof TypeError,
    });

    await assert.rejects(publishWithAttachment(params), /400/);
    assert.equal(attempts, 1);
});
