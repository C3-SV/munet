import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { buildPracticeWalls } from "./catalog.ts";
import {
    acknowledgePracticeReset,
    deletePracticeData,
    getPracticeStatus,
    resetPractice,
    revokeAllObjectUrls,
    runPracticeRequest,
    setPracticeStorageFactory,
} from "./gateway.ts";
import { PRACTICE_LIMIT_MESSAGES, PRACTICE_LIMITS } from "./limits.ts";
import { PRACTICE_UNAVAILABLE_MESSAGE, PracticeRequestError } from "./router.ts";
import { createInitialState, personaFor } from "./state.ts";
import { createMemoryStorage } from "./storage.ts";
import { clearPracticeFiles, peekPracticeFile, stashPracticeFile } from "./uploads.ts";

const run = (userId, method, path) => runPracticeRequest({ userId, method, path });
const call = (userId, method, path, body) => runPracticeRequest({ userId, method, path, body });

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

// Almacén en memoria que anota cada escritura en `log`. `failSaves` cuenta cuántos guardados rechazan y
// `failPutBlob` hace rechazar los binarios. Así se comprueba el orden de las escrituras y las reversiones.
const spyStorage = () => {
    const inner = createMemoryStorage();
    const log = [];
    const storage = {
        log,
        failSaves: 0,
        failPutBlob: false,
        load: () => inner.load(),
        save: async (state) => {
            log.push("save");
            if (storage.failSaves > 0) {
                storage.failSaves -= 1;
                throw new Error("cuota excedida");
            }
            await inner.save(state);
        },
        putBlob: async (id, blob) => {
            log.push(`putBlob:${id}`);
            if (storage.failPutBlob) {
                throw new Error("cuota de binarios excedida");
            }
            await inner.putBlob(id, blob);
        },
        getBlob: (id) => inner.getBlob(id),
        deleteBlob: async (id) => {
            log.push(`deleteBlob:${id}`);
            await inner.deleteBlob(id);
        },
        clear: () => inner.clear(),
    };
    return storage;
};

const spyPerUser = () => {
    const storages = new Map();
    const factory = async (userId) => {
        const storage = spyStorage();
        storages.set(userId, storage);
        return storage;
    };
    return { storages, factory };
};

const pngFile = (name = "mapa.png") =>
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });

// Ticket de subida en el muro general; el archivo todavía no está en el stash.
const initUpload = async (userId, overrides = {}) => {
    const { upload } = await call(userId, "POST", "/posts/attachments/init", {
        muro: "general",
        file_name: "mapa.png",
        mime_type: "image/png",
        size: 1000,
        ...overrides,
    });
    return upload;
};

// Sube el archivo al stash, confirma la publicación con su ticket y devuelve todo para comprobarlo.
const publishWithAttachment = async (userId, content = "Mapa de la sala", file = pngFile()) => {
    const upload = await initUpload(userId);
    stashPracticeFile(upload.id, file);
    const { post } = await call(userId, "POST", "/posts", { muro: "general", content, upload_id: upload.id });
    return { post, upload, file };
};

const originalFetch = globalThis.fetch;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
let fetchCalls = 0;
let createdUrls = [];
let revokedUrls = [];

beforeEach(() => {
    fetchCalls = 0;
    // Ninguna petición de práctica puede llegar a la red.
    globalThis.fetch = () => {
        fetchCalls += 1;
        throw new Error("fetch prohibido");
    };
    // URL blob: simuladas: cada una guarda el blob al que apunta para compararlo después.
    createdUrls = [];
    revokedUrls = [];
    URL.createObjectURL = (blob) => {
        const url = `blob:practice/${createdUrls.length + 1}`;
        createdUrls.push({ url, blob });
        return url;
    };
    URL.revokeObjectURL = (url) => {
        revokedUrls.push(url);
    };
});

afterEach(() => {
    setPracticeStorageFactory(null);
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    clearPracticeFiles();
});

test("walls: devuelve los tres muros accesibles de la persona del usuario", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const response = await run("u1", "GET", "/events/practice-local/walls");
    assert.equal(response.walls.length, 3);
    assert.deepEqual(
        response.walls,
        buildPracticeWalls(personaFor("u1").committeeId).filter((wall) => wall.canAccess),
    );
});

test("camino no simulado: rechaza con PracticeRequestError 501", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    await assert.rejects(
        () => run("u1", "PATCH", "/profiles/practice-membership"),
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
    await assert.rejects(
        () => run("u1", "PATCH", "/profiles/practice-membership"),
        isRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE),
    );
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
    // La siembra del estado ya intenta guardar: al fallar, la práctica pasa a memoria antes de la primera petición.
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: false, wasReset: false });

    const { profile } = await run("u1", "GET", "/profiles/me");
    assert.equal(profile.participantCode, "PRACTICA");
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: false, wasReset: false });
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
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: false, wasReset: false });

    const { profile } = await run("u1", "GET", "/profiles/me");
    assert.equal(profile.participantCode, "PRACTICA");
});

test("una escritura se guarda: load() devuelve el estado con la publicación nueva", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const { post } = await call("u1", "POST", "/posts", { muro: "general", content: "Mensaje persistido" });

    const saved = await storages.get("u1").load();
    assert.ok(saved.posts.some((item) => item.id === post.id && item.content === "Mensaje persistido"));
});

test("una lectura no guarda nada", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const storage = storages.get("u1");
    storage.log.splice(0);

    await run("u1", "GET", "/profiles/me");
    await run("u1", "GET", "/posts?muro=general");
    await run("u1", "GET", "/dm/conversations");
    await run("u1", "GET", "/events/practice-local/participants?page=1");
    assert.deepEqual(storage.log, []);
});

test("publicar con adjunto: el binario se guarda antes que el estado y getBlob lo devuelve", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const storage = storages.get("u1");
    storage.log.splice(0);

    const { post, upload, file } = await publishWithAttachment("u1");
    const attachmentId = post.attachment.id;
    assert.equal(await storage.getBlob(attachmentId), file);

    const putAt = storage.log.indexOf(`putBlob:${attachmentId}`);
    assert.ok(putAt >= 0, "se guardó el binario");
    assert.ok(storage.log.indexOf("save", putAt + 1) > putAt, "el estado se guarda después del binario");
    assert.equal(peekPracticeFile(upload.id), null, "el archivo ya no está en el stash");
    assert.equal(fetchCalls, 0);
});

test("reintento con el mismo upload_id: mismo post, sin 404 aunque el archivo ya se consumió", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const { post, upload } = await publishWithAttachment("u1");
    const replay = await call("u1", "POST", "/posts", {
        muro: "general",
        content: "Mapa de la sala",
        upload_id: upload.id,
    });
    assert.deepEqual(replay.post, post);
});

test("borrar la publicación con adjunto borra el binario después de guardar", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    const { post } = await publishWithAttachment("u1");
    const storage = storages.get("u1");
    const attachmentId = post.attachment.id;
    storage.log.splice(0);

    await call("u1", "DELETE", `/posts/${post.id}`);
    assert.equal(await storage.getBlob(attachmentId), null);
    const saveAt = storage.log.indexOf("save");
    assert.ok(saveAt >= 0, "se guardó el estado");
    assert.ok(storage.log.indexOf(`deleteBlob:${attachmentId}`) > saveAt, "el binario se borra después de guardar");
});

test("retirar el adjunto borra el binario después de guardar y revoca su URL", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    const { post } = await publishWithAttachment("u1");
    const storage = storages.get("u1");
    const attachmentId = post.attachment.id;
    const download = await call("u1", "GET", `/posts/${post.id}/attachment/download`);
    storage.log.splice(0);

    const removed = await call("u1", "DELETE", `/posts/${post.id}/attachment`);
    assert.deepEqual(removed, { removed: true, postId: post.id, attachmentId });
    assert.equal(await storage.getBlob(attachmentId), null);
    const saveAt = storage.log.indexOf("save");
    assert.ok(storage.log.indexOf(`deleteBlob:${attachmentId}`) > saveAt, "el binario se borra después de guardar");
    assert.ok(revokedUrls.includes(download.url));
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.equal(posts.find((item) => item.id === post.id).attachment, null);
});

test("descarga: devuelve una URL blob: con el binario del adjunto, sin guardar nada", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    const { post, file } = await publishWithAttachment("u1");
    const storage = storages.get("u1");
    storage.log.splice(0);

    const before = Date.now();
    const download = await call("u1", "GET", `/posts/${post.id}/attachment/download`);
    assert.match(download.url, /^blob:/);
    assert.equal(createdUrls.at(-1).url, download.url);
    assert.equal(createdUrls.at(-1).blob, file);
    const ttl = Date.parse(download.expiresAt) - before;
    assert.ok(ttl > 55_000 && ttl <= 60_000 + 1_000, `vigencia de 60 s, con ${ttl} ms`);
    assert.deepEqual(storage.log, []);
    assert.equal(fetchCalls, 0);
});

test("descarga de un adjunto sembrado: genera el PNG de la semilla", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    const seeded = posts.find((post) => post.attachment?.name === "ejemplo-imagen.png");
    assert.ok(seeded, "la semilla trae el ejemplo de imagen");

    const download = await call("u1", "GET", `/posts/${seeded.id}/attachment/download`);
    assert.match(download.url, /^blob:/);
    const { blob } = createdUrls.at(-1);
    assert.equal(blob.type, "image/png");
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).subarray(0, 8)], [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
});

test("descarga: errores del contrato de post sin adjunto, post inexistente y muro ajeno", async () => {
    const { stores, factory } = perUserStores();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const saved = await stores.get("u1").load();
    const foreignSlug = buildPracticeWalls(personaFor("u1").committeeId).find((wall) => !wall.canAccess).slug;

    const withoutAttachment = saved.posts.find((post) => post.attachment === null && post.wallSlug === "general");
    await assert.rejects(
        () => call("u1", "GET", `/posts/${withoutAttachment.id}/attachment/download`),
        isRequestError(404, "El post no tiene adjunto"),
    );
    await assert.rejects(
        () => call("u1", "GET", "/posts/practice-post-999999/attachment/download"),
        isRequestError(404, "Post no encontrado en este evento"),
    );
    const foreign = saved.posts.find((post) => post.wallSlug === foreignSlug);
    await assert.rejects(
        () => call("u1", "GET", `/posts/${foreign.id}/attachment/download`),
        isRequestError(403, "No tienes acceso a este post"),
    );
    assert.equal(createdUrls.length, 0);
});

test("upload_id sin archivo en el stash: 404 Subida no encontrada y no se crea la publicación", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const upload = await initUpload("u1");
    await assert.rejects(
        () => call("u1", "POST", "/posts", { muro: "general", content: "Sin archivo", upload_id: upload.id }),
        isRequestError(404, "Subida no encontrada"),
    );
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.ok(!posts.some((post) => post.content === "Sin archivo"));
    assert.equal(fetchCalls, 0);
});

test("save que rechaza: la escritura responde 507 y el estado en memoria queda como antes", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    storages.get("u1").failSaves = 1;

    await assert.rejects(
        () => call("u1", "POST", "/posts", { muro: "general", content: "Se pierde" }),
        isRequestError(507, PRACTICE_LIMIT_MESSAGES.totalBytes),
    );
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.ok(!posts.some((post) => post.content === "Se pierde"));
    assert.ok(!(await storages.get("u1").load()).posts.some((post) => post.content === "Se pierde"));
});

test("save que rechaza al publicar con adjunto: el binario se borra, el archivo vuelve al stash y el reintento funciona", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const storage = storages.get("u1");
    const upload = await initUpload("u1");
    const file = pngFile();
    stashPracticeFile(upload.id, file);
    const body = { muro: "general", content: "Con adjunto", upload_id: upload.id };
    storage.failSaves = 1;

    await assert.rejects(() => call("u1", "POST", "/posts", body), isRequestError(507, PRACTICE_LIMIT_MESSAGES.totalBytes));
    const putId = storage.log.find((entry) => entry.startsWith("putBlob:")).slice("putBlob:".length);
    assert.equal(await storage.getBlob(putId), null, "el binario que llegó a guardarse se borra");
    assert.equal(peekPracticeFile(upload.id), file, "el archivo vuelve al stash");
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.ok(!posts.some((post) => post.content === "Con adjunto"));

    const { post } = await call("u1", "POST", "/posts", body);
    assert.equal(post.attachment.name, "mapa.png");
    assert.equal(await storage.getBlob(post.attachment.id), file);
});

test("putBlob que rechaza (cuota de binarios): 507, estado sin cambios y el archivo sigue en el stash", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const storage = storages.get("u1");
    const upload = await initUpload("u1");
    const file = pngFile();
    stashPracticeFile(upload.id, file);
    const body = { muro: "general", content: "Sin binario", upload_id: upload.id };
    storage.log.splice(0);
    storage.failPutBlob = true;

    await assert.rejects(() => call("u1", "POST", "/posts", body), isRequestError(507, PRACTICE_LIMIT_MESSAGES.totalBytes));
    assert.equal(storage.log.includes("save"), false, "no se guarda un estado sin su binario");
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.ok(!posts.some((post) => post.content === "Sin binario"));
    assert.equal(peekPracticeFile(upload.id), file);

    storage.failPutBlob = false;
    const { post } = await call("u1", "POST", "/posts", body);
    assert.equal(await storage.getBlob(post.attachment.id), file);
});

test("tope total: si el estado supera maxTotalBytes la escritura responde 507 y no cambia nada", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const storage = storages.get("u1");
    storage.log.splice(0);

    await assert.rejects(
        () =>
            call("u1", "POST", "/posts", {
                muro: "general",
                content: "x".repeat(PRACTICE_LIMITS.maxTotalBytes),
            }),
        isRequestError(507, PRACTICE_LIMIT_MESSAGES.totalBytes),
    );
    assert.equal(storage.log.includes("save"), false);
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.ok(posts.every((post) => post.content.length < 1000));
});

test("dos escrituras a la vez se atienden en orden: si la primera no se guarda, la segunda sí", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    storages.get("u1").failSaves = 1;

    const [first, second] = await Promise.allSettled([
        call("u1", "POST", "/posts", { muro: "general", content: "Primera" }),
        call("u1", "POST", "/posts", { muro: "general", content: "Segunda" }),
    ]);
    assert.equal(first.status, "rejected");
    assert.ok(isRequestError(507, PRACTICE_LIMIT_MESSAGES.totalBytes)(first.reason));
    assert.equal(second.status, "fulfilled");
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.ok(!posts.some((post) => post.content === "Primera"));
    assert.ok(posts.some((post) => post.content === "Segunda"));
});

test("dos usuarios no comparten binarios: cada descarga entrega el archivo de su propia cuenta", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    const first = await publishWithAttachment("u1", "Del primero", pngFile("primero.png"));
    const second = await publishWithAttachment("u2", "Del segundo", pngFile("segundo.png"));

    assert.equal(await storages.get("u1").getBlob(first.post.attachment.id), first.file);
    assert.equal(await storages.get("u2").getBlob(second.post.attachment.id), second.file);

    await call("u2", "GET", `/posts/${second.post.id}/attachment/download`);
    assert.equal(createdUrls.at(-1).blob, second.file);
    await call("u1", "GET", `/posts/${first.post.id}/attachment/download`);
    assert.equal(createdUrls.at(-1).blob, first.file);
});

test("resetPractice: borra binarios y archivos pendientes, y revoca las URL del usuario", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    const { post } = await publishWithAttachment("u1");
    const download = await call("u1", "GET", `/posts/${post.id}/attachment/download`);
    const pending = await initUpload("u1");
    stashPracticeFile(pending.id, pngFile("pendiente.png"));

    await resetPractice("u1");
    const storage = storages.get("u1");
    assert.equal(await storage.load(), null);
    assert.equal(await storage.getBlob(post.attachment.id), null);
    assert.ok(revokedUrls.includes(download.url));
    assert.equal(peekPracticeFile(pending.id), null);
});

test("estado cargado con una foto de perfil que no es imagen permitida se reinicia", async () => {
    const storage = createMemoryStorage();
    const state = createInitialState("u1", new Date());
    await storage.save({ ...state, profile: { ...state.profile, avatar: "https://ejemplo.test/foto.png" } });
    setPracticeStorageFactory(async () => storage);

    await run("u1", "GET", "/profiles/me");
    assert.equal((await storage.load()).profile.avatar, null);
});

test("estado cargado con una foto data URI permitida se conserva", async () => {
    const avatar = "data:image/png;base64,iVBORw0KGgo=";
    const storage = createMemoryStorage();
    const state = createInitialState("u1", new Date());
    await storage.save({ ...state, profile: { ...state.profile, avatar } });
    setPracticeStorageFactory(async () => storage);

    await run("u1", "GET", "/profiles/me");
    assert.equal((await storage.load()).profile.avatar, avatar);
});

test("reiniciar borra el archivo pendiente de la propia cuenta", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const pending = await initUpload("u1");
    stashPracticeFile(pending.id, pngFile());

    await resetPractice("u1");
    assert.equal(peekPracticeFile(pending.id), null);
});

test("reiniciar A no borra el archivo pendiente de B", async () => {
    const { factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    const pendingB = await initUpload("u2");
    const fileB = pngFile("de-b.png");
    stashPracticeFile(pendingB.id, fileB);

    await resetPractice("u1");
    assert.equal(peekPracticeFile(pendingB.id), fileB);
});

test("reinicio con una escritura en vuelo: la escritura termina antes y el estado final queda sembrado sin binarios", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    const { post } = await publishWithAttachment("u1");
    const storage = storages.get("u1");

    // La escritura se queda parada dentro de save hasta que la prueba la suelta.
    const originalSave = storage.save;
    let enterSave;
    const saveEntered = new Promise((resolve) => {
        enterSave = resolve;
    });
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    storage.save = async (state) => {
        enterSave();
        await gate;
        return originalSave(state);
    };

    const write = call("u1", "POST", "/posts", { muro: "general", content: "En vuelo" });
    await Promise.race([saveEntered, write]);
    const reset = resetPractice("u1");
    release();
    const [writeResult, resetResult] = await Promise.allSettled([write, reset]);
    assert.equal(writeResult.status, "fulfilled", "la escritura en vuelo termina con éxito");
    assert.equal(resetResult.status, "fulfilled");

    // La siguiente lectura siembra de nuevo el estado: sin la publicación en vuelo y sin binarios.
    await run("u1", "GET", "/profiles/me");
    const saved = await storage.load();
    assert.equal(saved.userId, "u1");
    assert.equal(saved.posts.some((item) => item.content === "En vuelo"), false);
    assert.deepEqual(saved.uploads, []);
    assert.equal(await storage.getBlob(post.attachment.id), null);
});

test("revokeAllObjectUrls revoca las URL de descarga sin tocar el estado ni los binarios", async () => {
    const { storages, factory } = spyPerUser();
    setPracticeStorageFactory(factory);
    const { post } = await publishWithAttachment("u1");
    const download = await call("u1", "GET", `/posts/${post.id}/attachment/download`);

    await revokeAllObjectUrls("u1");
    assert.deepEqual(revokedUrls, [download.url]);
    assert.notEqual(await storages.get("u1").getBlob(post.attachment.id), null);
    const { posts } = await call("u1", "GET", "/posts?muro=general");
    assert.notEqual(posts.find((item) => item.id === post.id).attachment, null);

    // Una segunda llamada no vuelve a revocar la misma URL.
    await revokeAllObjectUrls("u1");
    assert.deepEqual(revokedUrls, [download.url]);
});

// Estado guardado con la versión 1: la carga lo descarta y debe marcar el reinicio.
const storedVersionOne = async () => {
    const storage = createMemoryStorage();
    await storage.save({ ...createInitialState("u1", new Date()), version: 1 });
    return storage;
};

test("getPracticeStatus: un estado de otra versión se reinicia, marca wasReset y el reconocimiento lo apaga", async () => {
    const storage = await storedVersionOne();
    setPracticeStorageFactory(async () => storage);

    assert.deepEqual(await getPracticeStatus("u1"), { persistent: true, wasReset: true });
    assert.equal((await storage.load()).version, 2);

    acknowledgePracticeReset("u1");
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: true, wasReset: false });
});

test("getPracticeStatus: sin estado previo ni reinicio manual, wasReset es falso", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: true, wasReset: false });
});

test("resetPractice manual no marca wasReset y apaga uno pendiente", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    await run("u1", "GET", "/profiles/me");
    await resetPractice("u1");
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: true, wasReset: false });

    const storage = await storedVersionOne();
    setPracticeStorageFactory(async () => storage);
    await resetPractice("u1");
    assert.deepEqual(await getPracticeStatus("u1"), { persistent: true, wasReset: false });
});

// IndexedDB simulada: el borrado responde de forma asíncrona, como el navegador, y anota el nombre pedido.
const fakeIndexedDb = (outcome = "success") => {
    const names = [];
    return {
        names,
        deleteDatabase(name) {
            names.push(name);
            const request = {};
            queueMicrotask(() => {
                if (outcome === "success") {
                    request.onsuccess?.({ target: request });
                } else if (outcome === "blocked") {
                    request.onblocked?.({ target: request });
                } else {
                    request.onerror?.({ target: request });
                }
            });
            return request;
        },
    };
};

// Ejecuta la tarea con indexedDB global sustituido y restaura el original después.
const withIndexedDb = async (indexedDB, task) => {
    const original = globalThis.indexedDB;
    globalThis.indexedDB = indexedDB;
    try {
        await task();
    } finally {
        globalThis.indexedDB = original;
    }
};

test("deletePracticeData borra la base del usuario, olvida su sesión y no toca la de otro", async () => {
    const { stores, factory } = perUserStores();
    setPracticeStorageFactory(factory);
    await run("u1", "GET", "/profiles/me");
    await run("u2", "GET", "/profiles/me");
    const firstStorage = stores.get("u1");
    const secondStorage = stores.get("u2");
    const indexedDB = fakeIndexedDb();

    await withIndexedDb(indexedDB, () => deletePracticeData("u1"));

    assert.deepEqual(indexedDB.names, ["munet-practice-u1"]);
    // La siguiente petición de u1 abre una sesión nueva con su propio almacén; la de u2 sigue igual.
    await run("u1", "GET", "/profiles/me");
    assert.notEqual(stores.get("u1"), firstStorage);
    assert.equal(stores.get("u2"), secondStorage);
    assert.notEqual(await secondStorage.load(), null);
});

test("deletePracticeData sin sesión abierta pide igualmente borrar la base", async () => {
    const indexedDB = fakeIndexedDb();
    await withIndexedDb(indexedDB, () => deletePracticeData("u9"));
    assert.deepEqual(indexedDB.names, ["munet-practice-u9"]);
});

test("deletePracticeData revoca las URL de descarga del usuario", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const { post } = await publishWithAttachment("u1");
    const download = await call("u1", "GET", `/posts/${post.id}/attachment/download`);

    await withIndexedDb(fakeIndexedDb(), () => deletePracticeData("u1"));
    assert.ok(revokedUrls.includes(download.url));
});

test("deletePracticeData toma los archivos pendientes de la propia cuenta y no los de otra", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const pendingA = await initUpload("u1");
    stashPracticeFile(pendingA.id, pngFile("de-a.png"));
    // Los ids salen del contador de cada estado: u2 publica antes para que su ticket no coincida con el de u1.
    await call("u2", "POST", "/posts", { muro: "general", content: "Antes del ticket" });
    const pendingB = await initUpload("u2");
    assert.notEqual(pendingA.id, pendingB.id);
    const fileB = pngFile("de-b.png");
    stashPracticeFile(pendingB.id, fileB);

    await withIndexedDb(fakeIndexedDb(), () => deletePracticeData("u1"));
    assert.equal(peekPracticeFile(pendingA.id), null);
    assert.equal(peekPracticeFile(pendingB.id), fileB);
});

test("deletePracticeData nunca rechaza: un borrado que lanza, falla o queda bloqueado no impide cerrar sesión", async () => {
    setPracticeStorageFactory(async () => createMemoryStorage());
    const throwing = {
        deleteDatabase() {
            throw new Error("SecurityError");
        },
    };
    for (const indexedDB of [throwing, fakeIndexedDb("error"), fakeIndexedDb("blocked")]) {
        await run("u1", "GET", "/profiles/me");
        await withIndexedDb(indexedDB, () => assert.doesNotReject(() => deletePracticeData("u1")));
    }
    await withIndexedDb(undefined, () => assert.doesNotReject(() => deletePracticeData("u1")));
});
