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

// ---------------------------------------------------------------------------
// Varios adjuntos

import { computePercent, publishWithAttachments } from "./attachment-upload.ts";
import { putFileWithProgress } from "./attachment-xhr.ts";

const file = (name, size = 100) => ({ name, size });
const ticketFor = (name) => ({ id: `up-${name}`, url: `https://r2.test/${name}`, method: "PUT", headers: { "Content-Type": "image/jpeg" } });

test("sube todos los archivos y crea el post una vez con los ids en el orden elegido", async () => {
    const files = [file("a"), file("b"), file("c"), file("d")];
    let created = 0;
    const result = await publishWithAttachments({
        files,
        initUpload: async (f) => ticketFor(f.name),
        upload: async (_ticket, f, onProgress) => {
            // Terminan en desorden: el orden de los ids no debe cambiar.
            await new Promise((r) => setTimeout(r, f.name === "a" ? 15 : 1));
            onProgress(f.size);
        },
        createPost: async (ids) => { created += 1; return { ids }; },
        isRetryable: () => false,
    });

    assert.equal(created, 1);
    assert.deepEqual(result.ids, ["up-a", "up-b", "up-c", "up-d"]);
});

test("limita cuántos archivos suben a la vez", async () => {
    let active = 0;
    let peak = 0;
    await publishWithAttachments({
        files: Array.from({ length: 8 }, (_, i) => file(`f${i}`)),
        concurrency: 3,
        initUpload: async (f) => ticketFor(f.name),
        upload: async () => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((r) => setTimeout(r, 5));
            active -= 1;
        },
        createPost: async () => "ok",
        isRetryable: () => false,
    });

    assert.equal(peak, 3);
});

test("informa el progreso por archivo y el total", async () => {
    const seen = [];
    await publishWithAttachments({
        files: [file("a", 100), file("b", 300)],
        concurrency: 1,
        initUpload: async (f) => ticketFor(f.name),
        upload: async (_t, f, onProgress) => { onProgress(f.size / 2); onProgress(f.size); },
        createPost: async () => "ok",
        isRetryable: () => false,
        onProgress: (progress) => seen.push(progress),
    });

    const last = seen.at(-1);
    assert.equal(last.stage, "publishing");
    assert.equal(last.percent, 100);
    assert.deepEqual(last.files.map((f) => f.status), ["done", "done"]);
    // En algún momento hubo un avance parcial.
    assert.ok(seen.some((p) => p.percent > 0 && p.percent < 100));
    assert.ok(seen.every((p) => p.percent >= 0 && p.percent <= 100));
});

test("si un archivo falla no se crea el post, no se arrancan los pendientes y se informa el error", async () => {
    let created = 0;
    const started = [];

    await assert.rejects(
        publishWithAttachments({
            files: [file("a"), file("b"), file("c"), file("d"), file("e")],
            concurrency: 1,
            initUpload: async (f) => { started.push(f.name); return ticketFor(f.name); },
            upload: async (_t, f) => { if (f.name === "b") throw new AttachmentUploadError("se cortó la red"); },
            createPost: async () => { created += 1; return "ok"; },
            isRetryable: () => false,
        }),
        /se cortó la red/,
    );

    assert.equal(created, 0);
    assert.deepEqual(started, ["a", "b"]);
});

test("reintenta crear el post una vez solo ante un corte de red", async () => {
    let attempts = 0;
    const result = await publishWithAttachments({
        files: [file("a")],
        retryDelayMs: 0,
        initUpload: async (f) => ticketFor(f.name),
        upload: async () => {},
        createPost: async () => { attempts += 1; if (attempts === 1) throw new TypeError("Failed to fetch"); return "creado"; },
        isRetryable: (error) => error instanceof TypeError,
    });

    assert.equal(result, "creado");
    assert.equal(attempts, 2);

    let apiAttempts = 0;
    await assert.rejects(publishWithAttachments({
        files: [file("a")],
        retryDelayMs: 0,
        initUpload: async (f) => ticketFor(f.name),
        upload: async () => {},
        createPost: async () => { apiAttempts += 1; throw new Error("rechazado por la API"); },
        isRetryable: () => false,
    }));
    assert.equal(apiAttempts, 1);
});

test("computePercent no pasa de 100 ni divide entre cero", () => {
    assert.equal(computePercent([]), 0);
    assert.equal(computePercent([{ size: 0, loaded: 0 }]), 0);
    assert.equal(computePercent([{ size: 100, loaded: 50 }, { size: 100, loaded: 500 }]), 75);
});

function fakeXhr({ status = 200, progress = [], fail = null } = {}) {
    const xhr = {
        headers: {},
        status,
        timeout: 0,
        upload: { onprogress: null },
        onload: null, onerror: null, onabort: null, ontimeout: null,
        open(method, url) { this.method = method; this.url = url; },
        setRequestHeader(name, value) { this.headers[name] = value; },
        abort() {},
        send(body) {
            this.body = body;
            queueMicrotask(() => {
                for (const loaded of progress) this.upload.onprogress?.({ lengthComputable: true, loaded });
                if (fail === "error") this.onerror?.();
                else this.onload?.();
            });
        },
    };
    return xhr;
}

test("subida con progreso: usa la URL y cabeceras firmadas e informa los bytes enviados", async () => {
    const xhr = fakeXhr({ progress: [10, 60, 100] });
    const loaded = [];
    await putFileWithProgress({ ...ticketFor("a"), headers: { "Content-Type": "image/jpeg", "Content-Length": "100" } }, "ARCHIVO", (n) => loaded.push(n), () => xhr);

    assert.equal(xhr.method, "PUT");
    assert.equal(xhr.url, "https://r2.test/a");
    assert.equal(xhr.body, "ARCHIVO");
    // Content-Length lo calcula el navegador: no se fija.
    assert.deepEqual(xhr.headers, { "Content-Type": "image/jpeg" });
    assert.deepEqual(loaded, [10, 60, 100]);
});

test("subida con progreso: 403 y corte de red dan mensajes entendibles", async () => {
    await assert.rejects(putFileWithProgress(ticketFor("a"), "x", () => {}, () => fakeXhr({ status: 403 })), /venció o el archivo no coincide/);
    await assert.rejects(putFileWithProgress(ticketFor("a"), "x", () => {}, () => fakeXhr({ status: 500 })), /No se pudo subir el archivo/);
    await assert.rejects(putFileWithProgress(ticketFor("a"), "x", () => {}, () => fakeXhr({ fail: "error" })), /Revisa tu conexión/);
});
