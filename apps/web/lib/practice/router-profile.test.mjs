import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { PRACTICE_MEMBERSHIP_ID } from "./constants.ts";
import { PRACTICE_LIMITS } from "./limits.ts";
import { PracticeRequestError, routePracticeRequest, routePracticeRequestDetailed } from "./router.ts";
import { createInitialState } from "./state.ts";

const NOW = new Date("2026-11-21T12:00:00Z");
const PRACTICE_UNAVAILABLE = "No disponible en modo práctica";
const PROTECTED_PREFIX = "No puedes modificar estos campos: ";
const ALIAS_TEXT = "alias debe ser texto";
const ALIAS_LENGTH = "alias admite hasta 60 caracteres";
const FORMAT = "Formato de imagen no permitido";
const NO_FILE = "No se recibio el archivo a subir";
const AVATAR_LIMIT_MESSAGE = "La imagen debe tener un tamano maximo de 256KB en la practica";
// Imagen PNG de 1x1 píxel en base64 (sin prefijo data:).
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const AVATAR_LIMIT_BYTES = 256 * 1024;

const BASE = createInitialState("u1", NOW);

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let state;

beforeEach(() => {
    // Ninguna escritura de la práctica puede llegar a la red.
    fetchCalls = 0;
    globalThis.fetch = () => {
        fetchCalls += 1;
        throw new Error("fetch prohibido");
    };
    state = createInitialState("u1", NOW);
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const call = (method, path, body) => routePracticeRequest({ method, path, body }, state, { now: NOW });
const outcome = (method, path, body) => routePracticeRequestDetailed({ method, path, body }, state, { now: NOW });
const isRequestError = (status, message) => (error) =>
    error instanceof PracticeRequestError && error.status === status && error.message === message;
const assertFails = (fn, status, message) => assert.throws(fn, isRequestError(status, message));
// Un intento fallido no cambia el estado.
const unchangedAfter = (fn) => {
    const before = JSON.stringify(state);
    assert.throws(fn, PracticeRequestError);
    assert.equal(JSON.stringify(state), before);
};

// Perfil interno de la respuesta: { profile: MyProfile } con su bloque `profile`.
const patchMe = (body) => call("PATCH", "/profiles/me", body).profile.profile;
const avatarUpload = (overrides) =>
    call("POST", "/profiles/me/avatar", { file_name: "foto.png", mime_type: "image/png", base64_data: PNG_1X1, ...overrides });
const publish = (content) => call("POST", "/posts", { muro: "general", content, post_type: "TEXT" }).post;

test("PATCH guarda nombre, alias y biografía tal cual, y GET /profiles/me los refleja", () => {
    const profile = patchMe({ display_name: "  Ana Ruiz ", alias: "  Anita  ", bio: "  Hola  " });
    assert.equal(profile.displayName, "Ana Ruiz");
    assert.equal(profile.alias, "Anita");
    assert.equal(profile.bio, "  Hola  ");
    const mine = call("GET", "/profiles/me").profile.profile;
    assert.equal(mine.displayName, "Ana Ruiz");
    assert.equal(mine.alias, "Anita");
    assert.equal(mine.bio, "  Hola  ");
    assert.equal(fetchCalls, 0);
});

test("alias de solo espacios queda como sin alias (null)", () => {
    patchMe({ alias: "Ana" });
    assert.equal(patchMe({ alias: "  " }).alias, null);
    assert.equal(state.profile.alias, null);
    assert.equal(patchMe({ alias: "Ana" }).alias, "Ana");
    assert.equal(patchMe({ alias: null }).alias, null);
});

test("alias de 60 caracteres se acepta y de 61 da 400 sin cambiar el perfil", () => {
    assert.equal(patchMe({ alias: "a".repeat(60) }).alias, "a".repeat(60));
    assertFails(() => call("PATCH", "/profiles/me", { alias: "b".repeat(61) }), 400, ALIAS_LENGTH);
    unchangedAfter(() => call("PATCH", "/profiles/me", { alias: "b".repeat(61) }));
});

test("el recorte del alias cuenta sin espacios: 60 caracteres con espacios alrededor se aceptan", () => {
    assert.equal(patchMe({ alias: `  ${"c".repeat(60)}  ` }).alias, "c".repeat(60));
});

test("alias que no es texto da 400 alias debe ser texto", () => {
    assertFails(() => call("PATCH", "/profiles/me", { alias: 7 }), 400, ALIAS_TEXT);
    unchangedAfter(() => call("PATCH", "/profiles/me", { alias: 7 }));
});

test("un PATCH sin alias conserva el alias anterior", () => {
    patchMe({ alias: "Ana" });
    assert.equal(patchMe({ bio: "Nueva bio" }).alias, "Ana");
});

test("campos protegidos: 400 con la lista en el orden role, participant_code, delegation_code, committee_id", () => {
    assertFails(
        () => call("PATCH", "/profiles/me", { committee_id: "practice-committee-ag", role: "ADMIN_MUN" }),
        400,
        `${PROTECTED_PREFIX}role, committee_id`,
    );
    assertFails(
        () => call("PATCH", "/profiles/me", {
            delegation_code: "#001",
            participant_code: "X",
            committee_id: null,
            role: undefined,
            display_name: "Otro",
        }),
        400,
        `${PROTECTED_PREFIX}role, participant_code, delegation_code, committee_id`,
    );
});

test("el enrutador directo trata una clave protegida con valor undefined como presente (la pasarela la elimina al normalizar el JSON)", () => {
    assertFails(() => call("PATCH", "/profiles/me", { role: undefined }), 400, `${PROTECTED_PREFIX}role`);
});

test("un error de validación no cambia el nombre ni el resto del perfil", () => {
    patchMe({ display_name: "Antes", alias: "Ana", bio: "Bio" });
    assertFails(
        () => call("PATCH", "/profiles/me", { display_name: "Nuevo", alias: "a".repeat(61) }),
        400,
        ALIAS_LENGTH,
    );
    assertFails(
        () => call("PATCH", "/profiles/me", { display_name: "Nuevo", role: "ADMIN_MUN" }),
        400,
        `${PROTECTED_PREFIX}role`,
    );
    assertFails(() => call("PATCH", "/profiles/me", { display_name: "Nuevo", alias: 3 }), 400, ALIAS_TEXT);
    unchangedAfter(() => call("PATCH", "/profiles/me", { display_name: "Nuevo", alias: 3 }));
    assert.equal(state.profile.displayName, "Antes");
});

test("display_name vacío o de espacios restaura el nombre de la persona", () => {
    patchMe({ display_name: "Ana Ruiz" });
    assert.equal(patchMe({ display_name: "" }).displayName, BASE.persona.displayName);
    assert.equal(state.profile.displayName, null);
    patchMe({ display_name: "Ana Ruiz" });
    assert.equal(patchMe({ display_name: "   " }).displayName, BASE.persona.displayName);
    assert.equal(state.profile.displayName, null);
});

test("el nombre editado aparece en las publicaciones y comentarios propios", () => {
    patchMe({ display_name: "Ana Ruiz" });
    const post = publish("Hola a todas");
    assert.equal(post.user.id, PRACTICE_MEMBERSHIP_ID);
    assert.equal(post.user.name, "Ana Ruiz");
    const comment = call("POST", `/posts/${post.id}/comments`, { content: "Y yo" }).comment;
    assert.equal(comment.user.name, "Ana Ruiz");
});

test("profile_image_path se ignora: el avatar no cambia", () => {
    const profile = call("PATCH", "/profiles/me", { profile_image_path: "https://example.com/a.png" }).profile.profile;
    assert.equal(state.profile.avatar, null);
    assert.ok(profile.avatar.startsWith("data:image/svg+xml"));
});

test("sin display_name en el cuerpo se conserva el nombre editado", () => {
    patchMe({ display_name: "Ana Ruiz" });
    assert.equal(patchMe({ bio: "Otra" }).displayName, "Ana Ruiz");
});

test("subir un PNG mínimo: aparece en GET /profiles/me y en las publicaciones propias", () => {
    const result = avatarUpload();
    const expected = `data:image/png;base64,${PNG_1X1}`;
    assert.equal(result.profile.profile.avatar, expected);
    assert.equal(call("GET", "/profiles/me").profile.profile.avatar, expected);
    assert.equal(publish("Con foto").user.avatar, expected);
    assert.equal(fetchCalls, 0);
});

test("los formatos JPEG y WEBP se aceptan y el tipo se normaliza a minúsculas", () => {
    assert.equal(avatarUpload({ mime_type: "image/jpeg" }).profile.profile.avatar, `data:image/jpeg;base64,${PNG_1X1}`);
    assert.equal(avatarUpload({ mime_type: "image/webp" }).profile.profile.avatar, `data:image/webp;base64,${PNG_1X1}`);
    assert.equal(avatarUpload({ mime_type: "IMAGE/PNG" }).profile.profile.avatar, `data:image/png;base64,${PNG_1X1}`);
});

test("un GIF da 400 de formato, aunque falten los datos", () => {
    assertFails(() => avatarUpload({ mime_type: "image/gif" }), 400, FORMAT);
    assertFails(() => avatarUpload({ mime_type: "image/gif", base64_data: "" }), 400, FORMAT);
    unchangedAfter(() => avatarUpload({ mime_type: "image/gif" }));
});

test("datos vacíos, de solo espacios o ausentes dan 400 No se recibio el archivo a subir", () => {
    assertFails(() => avatarUpload({ base64_data: "" }), 400, NO_FILE);
    assertFails(() => avatarUpload({ base64_data: "   " }), 400, NO_FILE);
    assertFails(() => avatarUpload({ base64_data: undefined }), 400, NO_FILE);
    unchangedAfter(() => avatarUpload({ base64_data: "" }));
});

test("base64 mal formado da 400 y no cambia el avatar", () => {
    assertFails(() => avatarUpload({ base64_data: "abc!" }), 400, NO_FILE);
    assertFails(() => avatarUpload({ base64_data: "AAA" }), 400, NO_FILE);
    assertFails(() => avatarUpload({ base64_data: "A===" }), 400, NO_FILE);
    unchangedAfter(() => avatarUpload({ base64_data: "AAA" }));
    assert.equal(state.profile.avatar, null);
});

test("el límite de 256 KB se mide en bytes decodificados: exactos se aceptan, uno más falla", () => {
    // 349528 caracteres con dos "=" finales son 262144 bytes; con un "=" serían 262145.
    const atLimit = `${"A".repeat(349526)}==`;
    const overLimit = `${"A".repeat(349527)}=`;
    assert.equal(Buffer.from(atLimit, "base64").length, AVATAR_LIMIT_BYTES);
    assert.equal(Buffer.from(overLimit, "base64").length, AVATAR_LIMIT_BYTES + 1);
    assert.equal(PRACTICE_LIMITS.maxAvatarBytes, AVATAR_LIMIT_BYTES);
    assert.equal(avatarUpload({ base64_data: atLimit }).profile.profile.avatar, `data:image/png;base64,${atLimit}`);
    assertFails(() => avatarUpload({ base64_data: overLimit }), 400, AVATAR_LIMIT_MESSAGE);
    unchangedAfter(() => avatarUpload({ base64_data: overLimit }));
});

test("PATCH /profiles/:membershipId y POST /profiles/:membershipId/avatar siguen sin implementar (501)", () => {
    assertFails(
        () => call("PATCH", "/profiles/practice-membership", { bio: "x" }),
        501,
        PRACTICE_UNAVAILABLE,
    );
    assertFails(
        () => call("POST", "/profiles/practice-membership/avatar", { mime_type: "image/png", base64_data: PNG_1X1 }),
        501,
        PRACTICE_UNAVAILABLE,
    );
});

test("la respuesta del PATCH marca la escritura y las lecturas no", () => {
    assert.equal(outcome("PATCH", "/profiles/me", { bio: "Hola" }).wrote, true);
    assert.equal(outcome("GET", "/profiles/me").wrote, false);
    assert.equal(BASE.profile.bio, "");
});
